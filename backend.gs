/* 
  GAS Backend for Survey Solo Pro (Expert GIS Version V4.1)
  --------------------------------------------------
  Sheet Structure:
  1. "users"          : username, password, name, role, province
  2. "projects"       : id, projectName, owner, province, sharedWith, mapUrl, data
  3. "survey_records" : record_id, project_id, feature_id, surveyor, status, lat, lng, photo_url, note, timestamp
*/

function doGet(e) {
  return ContentService.createTextOutput("Survey Solo Pro API V4.1 Running").setMimeType(ContentService.MimeType.TEXT);
}

/**
 * ฟังก์ชันซ่อมแซมหัวตาราง (Run ตัวนี้ 1 ครั้งในหน้า Editor ครับ)
 */
function checkHeaders() {
  var ss = getSS();
  
  // 1. ตรวจสอบชีตผู้ใช้
  var uSheet = ss.getSheetByName("users");
  if (!uSheet) {
    uSheet = ss.insertSheet("users");
    uSheet.appendRow(["username", "password", "name", "role", "province"]);
  }

  // 2. ตรวจสอบชีตโครงการ (7 คอลัมน์)
  var pSheet = ss.getSheetByName("projects");
  if (pSheet) {
    pSheet.getRange(1, 1, 1, 7).setValues([["id", "projectName", "owner", "province", "sharedWith", "mapUrl", "data"]]);
  } else {
    pSheet = ss.insertSheet("projects");
    pSheet.appendRow(["id", "projectName", "owner", "province", "sharedWith", "mapUrl", "data"]);
  }
  
  // 3. ตรวจสอบชีตบันทึกการสำรวจ (10 คอลัมน์)
  var sSheet = ss.getSheetByName("survey_records");
  if (sSheet) {
    sSheet.getRange(1, 1, 1, 10).setValues([["record_id", "project_id", "feature_id", "surveyor", "status", "lat", "lng", "photo_url", "note", "timestamp"]]);
  } else {
    sSheet = ss.insertSheet("survey_records");
    sSheet.appendRow(["record_id", "project_id", "feature_id", "surveyor", "status", "lat", "lng", "photo_url", "note", "timestamp"]);
  }
  return "ซ่อมแซมและตรวจสอบหัวตารางเรียบร้อยแล้ว";
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
    result = { status: "error", message: "Server Error: " + err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  const SS_ID = "1sw-TfUnkm7qdqW8D2mYZQ809r6u7QgjVd-X2T1Ar-ts";
  return SpreadsheetApp.openById(SS_ID);
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
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) { rowIndex = i + 1; break; }
  }
  
  var sharedStr = Array.isArray(sharedWith) ? sharedWith.join(",") : (sharedWith || "");
  var dataStr = typeof projectData === 'string' ? projectData : JSON.stringify(projectData || []);
  var mapUrlStr = mapUrl || "";

  var rowValues = [[id, projectName, username, province, sharedStr, mapUrlStr, dataStr]];
  
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, 7).setValues(rowValues);
  } else {
    sheet.appendRow(rowValues[0]);
  }
  
  return { status: "success" };
}

function getProjects(username) {
  var ss = getSS();
  var sheet = ss.getSheetByName("projects");
  if (!sheet) return { status: "success", projects: [] };
  
  var data = sheet.getDataRange().getValues();
  var projects = [];
  var searchUser = username ? username.toString().trim().toLowerCase() : "";

  for (var i = 1; i < data.length; i++) {
    try {
      var owner = data[i][2] ? data[i][2].toString().trim().toLowerCase() : "";
      var sharedWithStr = data[i][4] ? data[i][4].toString().trim().toLowerCase() : "";
      var sharedWith = sharedWithStr ? sharedWithStr.split(",") : [];
      
      if (owner === searchUser || sharedWith.indexOf(searchUser) !== -1) {
        var rawData = data[i][6] || "[]";
        var parsedData = [];
        try { 
          parsedData = (typeof rawData === 'string' && rawData.trim() !== "") ? JSON.parse(rawData) : []; 
          if (!Array.isArray(parsedData)) parsedData = [];
        } catch(je) { 
          parsedData = []; 
        }

        projects.push({
          id: data[i][0],
          projectName: data[i][1],
          owner: data[i][2], // คืนค่าจริงดั้งเดิม
          province: data[i][3],
          sharedWith: sharedWith,
          mapUrl: data[i][5] || "",
          data: parsedData
        });
      }
    } catch(e) {
      console.log("Error reading row " + i + ": " + e.message);
    }
  }
  return { status: "success", projects: projects };
}

function saveSurveyRecord(p) {
  var ss = getSS();
  var sheet = ss.getSheetByName("survey_records");
  if (!sheet) {
    sheet = ss.insertSheet("survey_records");
    sheet.appendRow(["record_id", "project_id", "feature_id", "surveyor", "status", "lat", "lng", "photo_url", "note", "timestamp"]);
  }

  var recordId = p.project_id + "_" + p.feature_id;
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;

  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === recordId) { rowIndex = i + 1; break; }
  }

  var rowData = [
    recordId, p.project_id, p.feature_id, p.username,
    p.status || "done", p.lat, p.lng, p.photo_url || "",
    p.note || "", new Date()
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
        record_id: data[i][0], feature_id: data[i][2],
        surveyor: data[i][3], status: data[i][4],
        lat: data[i][5], lng: data[i][6],
        photo_url: data[i][7], note: data[i][8],
        timestamp: data[i][9]
      });
    }
  }
  return { status: "success", records: records };
}

function login(username, password) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "error", message: "ไม่พบฐานข้อมูลผู้ใช้งาน" };
  var data = sheet.getDataRange().getValues();
  var searchUser = username ? username.toString().trim().toLowerCase() : "";
  var searchPass = password ? password.toString().trim() : "";

  for (var i = 1; i < data.length; i++) {
    var dbUser = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
    var dbPass = data[i][1] ? data[i][1].toString().trim() : "";
    if (dbUser === searchUser && dbPass === searchPass) {
      return { status: "success", user: { username: data[i][0], name: data[i][2], role: data[i][3], province: data[i][4] } };
    }
  }
  return { status: "error", message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" };
}

function register(username, password, name, province) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) { sheet = ss.insertSheet("users"); sheet.appendRow(["username", "password", "name", "role", "province"]); }
  var searchUser = username ? username.toString().trim().toLowerCase() : "";
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var dbUser = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
    if (dbUser === searchUser) return { status: "error", message: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" };
  }
  sheet.appendRow([username.toString().trim(), password.toString().trim(), name.toString().trim(), "user", province]);
  return { status: "success", message: "ลงทะเบียนสำเร็จ" };
}

function getStaff(province, excludeUser) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "success", staff: [] };
  var data = sheet.getDataRange().getValues();
  var staff = [];
  var searchProv = province ? province.toString().trim() : "";
  var searchEx = excludeUser ? excludeUser.toString().trim().toLowerCase() : "";

  for (var i = 1; i < data.length; i++) {
    var dbProv = data[i][4] ? data[i][4].toString().trim() : "";
    var dbUser = data[i][0] ? data[i][0].toString().trim().toLowerCase() : "";
    if (dbProv === searchProv && dbUser !== searchEx) {
      staff.push({ username: data[i][0], name: data[i][2] });
    }
  }
  return { status: "success", staff: staff };
}

function getConfig() {
  return { status: "success", config: { GOOGLE_MAPS_KEY: "AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY" } };
}
