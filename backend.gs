/* 
  GAS Backend for Survey Solo Pro (Expert GIS Version)
  --------------------------------------------------
  Sheet Structure:
  1. "users"          : username, password, name, role, province
  2. "projects"       : id, projectName, owner, province, sharedWith, mapUrl, data
  3. "survey_records" : record_id, project_id, feature_id, surveyor, status, lat, lng, photo_url, note, timestamp
*/

function doGet(e) {
  return ContentService.createTextOutput("Survey Solo Pro API V4 Running").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch(f) {
    return ContentService.createTextOutput(JSON.stringify({status:"error", message:"Invalid JSON"}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  var action = params.action;
  var result = { status: "error", message: "Unknown action: " + action };

  try {
    if (action === "login") {
      result = login(params.username, params.password);
    } else if (action === "register") {
      result = register(params.username, params.password, params.name, params.province);
    } else if (action === "saveProject") {
      result = saveProject(params.username, params.projectName, params.province, params.sharedWith, params.mapUrl, params.data);
    } else if (action === "getProjects") {
      result = getProjects(params.username);
    } else if (action === "saveSurveyRecord") {
      result = saveSurveyRecord(params);
    } else if (action === "getSurveyRecords") {
      result = getSurveyRecords(params.project_id);
    } else if (action === "getStaff") {
      result = getStaff(params.province, params.excludeUser);
    } else if (action === "getConfig") {
      result = getConfig();
    }
  } catch (err) {
    result = { status: "error", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  const SS_ID = "1sw-TfUnkm7qdqW8D2mYZQ809r6u7QgjVd-X2T1Ar-ts";
  return SpreadsheetApp.openById(SS_ID);
}

// --- Survey Records Management ---

function saveSurveyRecord(p) {
  var ss = getSS();
  var sheet = ss.getSheetByName("survey_records");
  if (!sheet) {
    sheet = ss.insertSheet("survey_records");
    sheet.appendRow(["record_id", "project_id", "feature_id", "surveyor", "status", "lat", "lng", "photo_url", "note", "timestamp"]);
  }

  // Check if record for this feature exists to update or append
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  var recordId = p.project_id + "_" + p.feature_id;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === recordId) {
      rowIndex = i + 1;
      break;
    }
  }

  var rowData = [
    recordId,
    p.project_id,
    p.feature_id,
    p.username,
    p.status || "done",
    p.lat,
    p.lng,
    p.photo_url || "",
    p.note || "",
    new Date()
  ];

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, 10).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { status: "success", message: "บันทึกข้อมูลสำรวจเรียบร้อย" };
}

function getSurveyRecords(projectId) {
  var ss = getSS();
  var sheet = ss.getSheetByName("survey_records");
  if (!sheet) return { status: "success", records: [] };

  var data = sheet.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === projectId) {
      records.push({
        record_id: data[i][0],
        feature_id: data[i][2],
        surveyor: data[i][3],
        status: data[i][4],
        lat: data[i][5],
        lng: data[i][6],
        photo_url: data[i][7],
        note: data[i][8],
        timestamp: data[i][9]
      });
    }
  }
  return { status: "success", records: records };
}

// --- Original Functions (Updated for V4) ---

function login(username, password) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "error", message: "ไม่พบฐานข้อมูลผู้ใช้งาน" };
  var data = sheet.getDataRange().getValues();
  username = username.toString().trim();
  password = password.toString().trim();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === username && data[i][1].toString().trim() === password) {
      return { status: "success", user: { username: data[i][0], name: data[i][2], role: data[i][3], province: data[i][4] } };
    }
  }
  return { status: "error", message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" };
}

function register(username, password, name, province) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) { sheet = ss.insertSheet("users"); sheet.appendRow(["username", "password", "name", "role", "province"]); }
  username = username.toString().trim();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === username) return { status: "error", message: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" };
  }
  sheet.appendRow([username, password.toString().trim(), name.toString().trim(), "user", province]);
  return { status: "success", message: "ลงทะเบียนสำเร็จ" };
}

function saveProject(username, projectName, province, sharedWith, mapUrl, projectData) {
  var ss = getSS();
  var sheet = ss.getSheetByName("projects");
  if (!sheet) {
    sheet = ss.insertSheet("projects");
    sheet.appendRow(["id", "projectName", "owner", "province", "sharedWith", "mapUrl", "data"]);
  }
  var id = username + "_" + projectName;
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) { if (data[i][0] === id) { rowIndex = i + 1; break; } }
  var sharedStr = Array.isArray(sharedWith) ? sharedWith.join(",") : (sharedWith || "");
  var dataStr = typeof projectData === 'string' ? projectData : JSON.stringify(projectData || []);
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, 7).setValues([[id, projectName, username, province, sharedStr, mapUrl || "", dataStr]]);
  } else {
    sheet.appendRow([id, projectName, username, province, sharedStr, mapUrl || "", dataStr]);
  }
  return { status: "success" };
}

function getProjects(username) {
  var ss = getSS();
  var sheet = ss.getSheetByName("projects");
  if (!sheet) return { status: "success", projects: [] };
  var data = sheet.getDataRange().getValues();
  var projects = [];
  for (var i = 1; i < data.length; i++) {
    var sharedWith = data[i][4] ? data[i][4].toString().split(",") : [];
    if (data[i][2] === username || sharedWith.indexOf(username) !== -1) {
      projects.push({ id: data[i][0], projectName: data[i][1], owner: data[i][2], province: data[i][3], sharedWith: sharedWith, mapUrl: data[i][5] || "", data: JSON.parse(data[i][6] || "[]") });
    }
  }
  return { status: "success", projects: projects };
}

function getStaff(province, excludeUser) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "success", staff: [] };
  var data = sheet.getDataRange().getValues();
  var staff = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === province && data[i][0] !== excludeUser) staff.push({ username: data[i][0], name: data[i][2] });
  }
  return { status: "success", staff: staff };
}

function getConfig() {
  return { status: "success", config: { GOOGLE_MAPS_KEY: "AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY" } };
}
