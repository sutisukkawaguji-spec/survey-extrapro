/* 
  GAS Backend for Survey Solo Pro (Expert GIS Version V4.3 - Report Optimized)
  --------------------------------------------------
  Sheet Structure:
  1. "users"          : username, password, name, role, province
  2. "projects"       : id, projectName, owner, province, sharedWith, mapUrl, data
  3. "survey_records" : record_id, project_id, feature_id, surveyor, status, lat, lng, photo_url, note, timestamp
*/

function doGet(e) {
  return ContentService.createTextOutput("Survey Solo Pro API V4.3 Running").setMimeType(ContentService.MimeType.TEXT);
}

function checkHeaders() {
  var ss = getSS();
  var pSheet = ss.getSheetByName("projects") || ss.insertSheet("projects");
  pSheet.getRange(1, 1, 1, 7).setValues([["id", "projectName", "owner", "province", "sharedWith", "mapUrl", "data"]]);
  var sSheet = ss.getSheetByName("survey_records") || ss.insertSheet("survey_records");
  sSheet.getRange(1, 1, 1, 10).setValues([["record_id", "project_id", "feature_id", "surveyor", "status", "lat", "lng", "photo_url", "note", "timestamp"]]);
  var uSheet = ss.getSheetByName("users") || ss.insertSheet("users");
  if (uSheet.getLastRow() === 0) uSheet.appendRow(["username", "password", "name", "role", "province"]);
  return "SUCCESS: Headers Updated";
}

function doPost(e) {
  var params;
  try { params = JSON.parse(e.postData.contents); } catch(f) { return ContentService.createTextOutput(JSON.stringify({status:"error", message:"Invalid JSON"})).setMimeType(ContentService.MimeType.JSON); }
  
  var action = params.action;
  var result = { status: "error", message: "Unknown action: " + action };
  try {
    if (action === "login") result = login(params.username, params.password);
    else if (action === "register") result = register(params.username, params.password, params.name, params.province);
    else if (action === "saveProject") result = saveProject(params.username, params.projectName, params.province, params.sharedWith, params.mapUrl, params.data);
    else if (action === "getProjects") result = getProjects(params.username);
    else if (action === "saveSurveyRecord") result = saveSurveyRecord(params);
    else if (action === "getSurveyRecords") result = getSurveyRecords(params.project_id);
    else if (action === "getStaff") result = getStaff(params.province, params.excludeUser);
    else if (action === "getConfig") result = getConfig();
    else if (action === "fetchExternalMap") result = fetchExternalMap(params.url);
    else if (action === "getMapLibrary") result = getMapLibrary();
    else if (action === "saveMapToLibrary") result = saveMapToLibrary(params);
    else if (action === "deleteMapFromLibrary") result = deleteMapFromLibrary(params.name);
  } catch (err) { result = { status: "error", message: "GAS Error: " + err.toString() }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  const SS_ID = "1sw-TfUnkm7qdqW8D2mYZQ809r6u7QgjVd-X2T1Ar-ts";
  try { return SpreadsheetApp.openById(SS_ID); } catch (e) { return SpreadsheetApp.getActiveSpreadsheet(); }
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
        try { parsedData = (typeof rawData === 'string' && rawData.trim() !== "") ? JSON.parse(rawData) : []; } catch(je) { parsedData = []; }
        projects.push({ id: data[i][0], projectName: data[i][1], owner: data[i][2], province: data[i][3], sharedWith: sharedWith, mapUrl: data[i][5] || "", data: Array.isArray(parsedData) ? parsedData : [] });
      }
    } catch(e) { console.log("Row " + i + " error: " + e.message); }
  }
  return { status: "success", projects: projects };
}

function saveProject(username, projectName, province, sharedWith, mapUrl, projectData) {
  var ss = getSS();
  var sheet = ss.getSheetByName("projects") || ss.insertSheet("projects");
  var id = username + "_" + projectName;
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) { if (data[i][0] === id) { rowIndex = i + 1; break; } }
  var sharedStr = Array.isArray(sharedWith) ? sharedWith.join(",") : (sharedWith || "");
  var dataStr = typeof projectData === 'string' ? projectData : JSON.stringify(projectData || []);
  var rowValues = [[id, projectName, username, province, sharedStr, mapUrl || "", dataStr]];
  if (rowIndex > -1) sheet.getRange(rowIndex, 1, 1, 7).setValues(rowValues);
  else sheet.appendRow(rowValues[0]);
  return { status: "success" };
}

function getSurveyRecords(projectId) {
  var ss = getSS();
  var sheet = ss.getSheetByName("survey_records");
  if (!sheet) return { status: "success", records: [] };
  var data = sheet.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < data.length; i++) {
    if (projectId === 'ALL' || data[i][1] === projectId) {
      // แปลงวันที่เป็น YYYY-MM-DD เพื่อทำจุดสีในปฏิทินหน้าบ้าน
      var d = new Date(data[i][9]);
      var isoDate = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
      records.push({ 
        project_id: data[i][1], feature_id: data[i][2], surveyor: data[i][3], 
        status: data[i][4], lat: data[i][5], lng: data[i][6], 
        photo_url: data[i][7], note: data[i][8], date: isoDate, timestamp: data[i][9]
      });
    }
  }
  return { status: "success", records: records };
}

function saveSurveyRecord(p) {
  var ss = getSS();
  var sheet = ss.getSheetByName("survey_records") || ss.insertSheet("survey_records");
  var recordId = p.project_id + "_" + p.feature_id;
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) { if (data[i][0] === recordId) { rowIndex = i + 1; break; } }
  var rowData = [recordId, p.project_id, p.feature_id, p.username, p.status || "done", p.lat, p.lng, p.photo_url || "", p.note || "", new Date()];
  if (rowIndex > -1) sheet.getRange(rowIndex, 1, 1, 10).setValues([rowData]);
  else sheet.appendRow(rowData);
  return { status: "success" };
}

function login(username, password) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "error", message: "No user database" };
  var data = sheet.getDataRange().getValues();
  var u = username ? username.toString().trim().toLowerCase() : "";
  var p = password ? password.toString().trim() : "";
  for (var i = 1; i < data.length; i++) { if (data[i][0].toString().trim().toLowerCase() === u && data[i][1].toString().trim() === p) return { status: "success", user: { username: data[i][0], name: data[i][2], role: data[i][3], province: data[i][4], isLoggedIn: true } }; }
  return { status: "error", message: "Invalid username or password" };
}

function register(username, password, name, province) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users") || ss.insertSheet("users");
  var u = username ? username.toString().trim().toLowerCase() : "";
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { if (data[i][0].toString().trim().toLowerCase() === u) return { status: "error", message: "User exists" }; }
  sheet.appendRow([username.toString().trim(), password.toString().trim(), name.toString().trim(), "user", province]);
  return { status: "success", message: "Registered" };
}

function getStaff(province, excludeUser) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "success", staff: [] };
  var data = sheet.getDataRange().getValues();
  var staff = [];
  var p = province ? province.toString().trim() : "";
  var ex = excludeUser ? excludeUser.toString().trim().toLowerCase() : "";
  for (var i = 1; i < data.length; i++) { if (data[i][4].toString().trim() === p && data[i][0].toString().trim().toLowerCase() !== ex) staff.push({ username: data[i][0], name: data[i][2] }); }
  return { status: "success", staff: staff };
}

function getConfig() { return { status: "success", config: { GOOGLE_MAPS_KEY: "AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY" } }; }
function fetchExternalMap(url) {
  try {
    let content = "";
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/(.+?)\//) || url.match(/id=(.+?)(&|$)/);
      if (match) {
        // ใช้ DriveApp ดึงข้อมูลโดยตรง (เสถียรกว่ามากและข้ามหน้าแจ้งเตือนไวรัส)
        content = DriveApp.getFileById(match[1]).getBlob().getDataAsString();
      } else {
        throw new Error("ไม่สามารถระบุ ID ไฟล์จากลิงก์ได้");
      }
    } else {
      // สำหรับ URL ทั่วไปที่ไม่ใช่ Google Drive
      const response = UrlFetchApp.fetch(url);
      content = response.getContentText();
    }
    return { status: "success", data: JSON.parse(content) };
  } catch (e) {
    return { status: "error", message: "ดึงข้อมูลล้มเหลว: " + e.toString() };
  }
}
function getMapLibrary() {
  var ss = getSS();
  var sheet = ss.getSheetByName("map_library") || ss.insertSheet("map_library");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["name", "url"]);
    return { status: "success", maps: [] };
  }
  var data = sheet.getDataRange().getValues();
  var maps = [];
  for (var i = 1; i < data.length; i++) {
    maps.push({ name: data[i][0], url: data[i][1] });
  }
  return { status: "success", maps: maps };
}

function saveMapToLibrary(p) {
  var ss = getSS();
  var sheet = ss.getSheetByName("map_library") || ss.insertSheet("map_library");
  if (sheet.getLastRow() === 0) sheet.appendRow(["name", "url"]);
  
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === p.name) { rowIndex = i + 1; break; }
  }
  
  if (rowIndex > -1) sheet.getRange(rowIndex, 2).setValue(p.url);
  else sheet.appendRow([p.name, p.url]);
  
  return { status: "success" };
}

function deleteMapFromLibrary(name) {
  var ss = getSS();
  var sheet = ss.getSheetByName("map_library");
  if (!sheet) return { status: "error" };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === name) {
      sheet.deleteRow(i + 1);
      return { status: "success" };
    }
  }
  return { status: "error" };
}
