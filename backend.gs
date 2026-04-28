/* 
  GAS Backend for Survey Solo Pro (Advanced Version V3)
  --------------------------------------------------
  Sheet Structure:
  1. "users"    : username, password, name, role, province
  2. "projects" : id, projectName, owner, province, sharedWith, mapUrl, data
*/

function doGet(e) {
  return ContentService.createTextOutput("GAS Backend V3 is Running").setMimeType(ContentService.MimeType.TEXT);
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

function checkHeaders() {
  var ss = getSS();
  var pSheet = ss.getSheetByName("projects");
  if (pSheet) {
    var headers = pSheet.getRange(1, 1, 1, 7).getValues()[0];
    if (headers[5] !== "mapUrl") {
      // If old structure, we need to fix it. 
      // This is a bit complex for a simple script, so we'll just ensure save/get uses correct column mapping.
      // Easiest is to force correct headers if not matching.
      pSheet.getRange(1, 1, 1, 7).setValues([["id", "projectName", "owner", "province", "sharedWith", "mapUrl", "data"]]);
    }
  } else {
    pSheet = ss.insertSheet("projects");
    pSheet.appendRow(["id", "projectName", "owner", "province", "sharedWith", "mapUrl", "data"]);
  }
}

function login(username, password) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "error", message: "ไม่พบฐานข้อมูลผู้ใช้งาน" };
  
  var data = sheet.getDataRange().getValues();
  username = username.toString().trim();
  password = password.toString().trim();

  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === username && data[i][1].toString().trim() === password) {
      return { 
        status: "success", 
        user: { 
          username: data[i][0], 
          name: data[i][2], 
          role: data[i][3],
          province: data[i][4]
        } 
      };
    }
  }
  return { status: "error", message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" };
}

function register(username, password, name, province) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) {
    sheet = ss.insertSheet("users");
    sheet.appendRow(["username", "password", "name", "role", "province"]);
  }
  
  username = username.toString().trim();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0].toString().trim() === username) {
      return { status: "error", message: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" };
    }
  }
  
  sheet.appendRow([username, password.toString().trim(), name.toString().trim(), "user", province]);
  return { status: "success", message: "ลงทะเบียนสำเร็จ" };
}

function saveProject(username, projectName, province, sharedWith, mapUrl, projectData) {
  checkHeaders();
  var ss = getSS();
  var sheet = ss.getSheetByName("projects");
  
  var id = username + "_" + projectName;
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  var sharedStr = Array.isArray(sharedWith) ? sharedWith.join(",") : (sharedWith || "");
  var dataStr = typeof projectData === 'string' ? projectData : JSON.stringify(projectData || []);
  var mapUrlStr = mapUrl || "";

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 2, 1, 6).setValues([[projectName, username, province, sharedStr, mapUrlStr, dataStr]]);
  } else {
    sheet.appendRow([id, projectName, username, province, sharedStr, mapUrlStr, dataStr]);
  }
  
  return { status: "success" };
}

function getProjects(username) {
  checkHeaders();
  var ss = getSS();
  var sheet = ss.getSheetByName("projects");
  if (!sheet) return { status: "success", projects: [] };
  
  var data = sheet.getDataRange().getValues();
  var projects = [];
  for (var i = 1; i < data.length; i++) {
    var id = data[i][0];
    var pName = data[i][1];
    var owner = data[i][2];
    var prov = data[i][3];
    var sharedWith = data[i][4] ? data[i][4].toString().split(",") : [];
    var mapUrl = data[i][5] || "";
    var rawData = data[i][6];
    
    // Check if user is owner or in shared list
    if (owner === username || sharedWith.indexOf(username) !== -1) {
      var parsedData = [];
      try {
        parsedData = rawData ? JSON.parse(rawData) : [];
      } catch(e) { console.error("Parse error for project", id); }
      
      projects.push({
        id: id,
        projectName: pName,
        owner: owner,
        province: prov,
        sharedWith: sharedWith,
        mapUrl: mapUrl,
        data: parsedData
      });
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
    if (data[i][4] === province && data[i][0] !== excludeUser) {
      staff.push({
        username: data[i][0],
        name: data[i][2]
      });
    }
  }
  return { status: "success", staff: staff };
}

function getConfig() {
  return {
    status: "success",
    config: {
      GOOGLE_MAPS_KEY: "AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY"
    }
  };
}
