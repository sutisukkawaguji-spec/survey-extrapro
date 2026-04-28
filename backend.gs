/* 
  GAS Backend for Survey Solo Pro (V4.6 - Memory Optimized & Dynamic Folder)
  --------------------------------------------------
*/

function doGet(e) {
  return ContentService.createTextOutput("Survey Solo Pro API V4.6 Running").setMimeType(ContentService.MimeType.TEXT);
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
    else if (action === "get_map_data") result = get_map_data(params.url || params.id);
    else if (action === "getMapLibrary") result = getMapLibrary();
    else if (action === "saveMapToLibrary") result = saveMapToLibrary(params);
    else if (action === "deleteMapFromLibrary") result = deleteMapFromLibrary(params.name);
    else if (action === "get_map_list") result = get_map_list(params.folder_url);
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
  var u = username.toString().trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    var owner = data[i][2].toString().trim().toLowerCase();
    var shared = data[i][4].toString().split(",").map(function(s){return s.trim().toLowerCase();});
    if (owner === u || shared.indexOf(u) > -1) {
      projects.push({ id: data[i][0], projectName: data[i][1], owner: data[i][2], province: data[i][3], sharedWith: data[i][4] ? data[i][4].split(",") : [], mapUrl: data[i][5], data: data[i][6] ? JSON.parse(data[i][6]) : [] });
    }
  }
  return { status: "success", projects: projects };
}

function saveProject(username, projectName, province, sharedWith, mapUrl, data) {
  var ss = getSS();
  var sheet = ss.getSheetByName("projects") || ss.insertSheet("projects");
  var id = "PROJ_" + new Date().getTime();
  sheet.appendRow([id, projectName, username, province, sharedWith.join(","), mapUrl, JSON.stringify(data)]);
  return { status: "success", id: id };
}

function getSurveyRecords(projectId) {
  var ss = getSS();
  var sheet = ss.getSheetByName("survey_records");
  if (!sheet) return { status: "success", records: [] };
  var data = sheet.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < data.length; i++) {
    if (projectId === 'ALL' || data[i][1] === projectId) {
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
  for (var i = 1; i < data.length; i++) { if (data[i][0].toString().trim().toLowerCase() === u) return { status: "error", message: "Username already exists" }; }
  sheet.appendRow([u, password, name, "staff", province]);
  return { status: "success" };
}

function getStaff(province, excludeUser) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "success", staff: [] };
  var data = sheet.getDataRange().getValues();
  var staff = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][4] === province && data[i][0] !== excludeUser) {
      staff.push({ username: data[i][0], name: data[i][2] });
    }
  }
  return { status: "success", staff: staff };
}

function getConfig() { return { status: "success", config: { GOOGLE_MAPS_KEY: "AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY" } }; }

function get_map_data(urlOrId) {
  try {
    let id = urlOrId;
    if (urlOrId.includes('drive.google.com')) {
      const match = urlOrId.match(/\/d\/(.+?)\//) || urlOrId.match(/id=(.+?)(&|$)/);
      if (match) id = match[1];
    }
    // ใช้ getBlob().getDataAsString('UTF-8') และส่งออกเป็น data_string เพื่อประหยัด Memory ฝั่ง Server
    var content = DriveApp.getFileById(id).getBlob().getDataAsString('UTF-8');
    return { status: "success", data_string: content };
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
  for (var i = 1; i < data.length; i++) { maps.push({ name: data[i][0], url: data[i][1] }); }
  return { status: "success", maps: maps };
}

function saveMapToLibrary(p) {
  var ss = getSS();
  var sheet = ss.getSheetByName("map_library") || ss.insertSheet("map_library");
  if (sheet.getLastRow() === 0) sheet.appendRow(["name", "url"]);
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) { if (data[i][0] === p.name) { rowIndex = i + 1; break; } }
  if (rowIndex > -1) sheet.getRange(rowIndex, 2).setValue(p.url);
  else sheet.appendRow([p.name, p.url]);
  return { status: "success" };
}

function deleteMapFromLibrary(name) {
  var ss = getSS();
  var sheet = ss.getSheetByName("map_library");
  if (!sheet) return { status: "error" };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { if (data[i][0] === name) { sheet.deleteRow(i + 1); return { status: "success" }; } }
  return { status: "error" };
}

function get_map_list(folderUrl) {
  try {
    let folderId = folderUrl;
    if (folderUrl.includes('drive.google.com')) {
      const match = folderUrl.match(/folders\/([\w-]+)/) || folderUrl.match(/id=([\w-]+)/);
      if (match) folderId = match[1];
    }
    var folder = DriveApp.getFolderById(folderId);
    var files = folder.getFiles();
    var list = [];
    var loadedNames = {};
    
    while (files.hasNext()) {
      var file = files.next();
      var filename = file.getName().toLowerCase();
      
      // เช็คว่าเป็นไฟล์ .json หรือ .geojson หรือไม่
      if (filename.endsWith('.json') || filename.endsWith('.geojson')) {
        var baseName = filename.replace('.json', '').replace('.geojson', '');
        if (loadedNames[baseName]) continue; // ป้องกันไฟล์ซ้ำกรณีมีทั้งสองนามสกุล
        loadedNames[baseName] = true;
        
        list.push({
          id: file.getId(),
          filename: file.getName()
        });
      }
    }
    return { status: "success", list: list };
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}
