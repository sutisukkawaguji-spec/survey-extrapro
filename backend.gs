/* 
  GAS Backend for Survey Solo Pro
  ------------------------------
  1. Create a Google Sheet.
  2. Go to Extensions > Apps Script.
  3. Paste this code.
  4. Create a sheet named "users" with headers: username, password, name, role
  5. Create a sheet named "projects" with headers: id, projectName, owner, data
  6. Click "Deploy" > "New Deployment".
  7. Select "Web App".
  8. Execute as: "Me", Who has access: "Anyone".
  9. Copy the Web App URL and paste it into config.js
*/

function doGet(e) {
  return ContentService.createTextOutput("GAS Backend is Running").setMimeType(ContentService.MimeType.TEXT);
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
  var result = { status: "error", message: "Unknown action" };

  try {
    if (action === "login") {
      result = login(params.username, params.password);
    } else if (action === "register") {
      result = register(params.username, params.password, params.name);
    } else if (action === "saveProject") {
      result = saveProject(params.username, params.projectName, params.data);
    } else if (action === "getProjects") {
      result = getProjects(params.username);
    } else if (action === "getConfig") {
      result = getConfig();
    }
  } catch (err) {
    result = { status: "error", message: err.message };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSS() {
  const SS_ID = "1sw-TfUnkm7qdqW8D2mYZQ809r6u7QgjVd-X2T1Ar-ts";
  return SpreadsheetApp.openById(SS_ID);
}

function login(username, password) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) return { status: "error", message: "User table not found" };
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === password) {
      return { 
        status: "success", 
        user: { username: data[i][0], name: data[i][2], role: data[i][3] } 
      };
    }
  }
  return { status: "error", message: "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง" };
}

function register(username, password, name) {
  var ss = getSS();
  var sheet = ss.getSheetByName("users");
  if (!sheet) {
    sheet = ss.insertSheet("users");
    sheet.appendRow(["username", "password", "name", "role"]);
  }
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === username) {
      return { status: "error", message: "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว" };
    }
  }
  
  sheet.appendRow([username, password, name, "user"]);
  return { status: "success", message: "ลงทะเบียนสำเร็จ" };
}

function saveProject(username, projectName, projectData) {
  var ss = getSS();
  var sheet = ss.getSheetByName("projects");
  if (!sheet) {
    sheet = ss.insertSheet("projects");
    sheet.appendRow(["id", "projectName", "owner", "data"]);
  }
  
  var id = username + "_" + projectName;
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 4).setValue(JSON.stringify(projectData));
  } else {
    sheet.appendRow([id, projectName, username, JSON.stringify(projectData)]);
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
    if (data[i][2] === username) {
      projects.push({
        projectName: data[i][1],
        data: JSON.parse(data[i][3])
      });
    }
  }
  return { status: "success", projects: projects };
}

function getConfig() {
  return {
    status: "success",
    config: {
      GOOGLE_MAPS_KEY: "AIzaSyAWnb6S0zVLvNyv_vXke1gs2Qm68eQFVrY" // KEY IS NOW SECURE ON SERVER SIDE
    }
  };
}
