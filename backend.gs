/* 
  GAS Backend for Survey Solo Pro (Advanced Version)
  --------------------------------------------------
  Sheet Structure:
  1. "users"    : username, password, name, role, province
  2. "projects" : id, projectName, owner, province, sharedWith, data
*/

function doGet(e) {
  return ContentService.createTextOutput("GAS Backend V2 is Running").setMimeType(ContentService.MimeType.TEXT);
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
      result = register(params.username, params.password, params.name, params.province);
    } else if (action === "saveProject") {
      result = saveProject(params.username, params.projectName, params.province, params.sharedWith, params.data);
    } else if (action === "getProjects") {
      result = getProjects(params.username);
    } else if (action === "getStaff") {
      result = getStaff(params.province, params.excludeUser);
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

function saveProject(username, projectName, province, sharedWith, projectData) {
  var ss = getSS();
  var sheet = ss.getSheetByName("projects");
  if (!sheet) {
    sheet = ss.insertSheet("projects");
    sheet.appendRow(["id", "projectName", "owner", "province", "sharedWith", "data"]);
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
  
  var sharedStr = Array.isArray(sharedWith) ? sharedWith.join(",") : "";
  var dataStr = typeof projectData === 'string' ? projectData : JSON.stringify(projectData);

  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 2, 1, 5).setValues([[projectName, username, province, sharedStr, dataStr]]);
  } else {
    sheet.appendRow([id, projectName, username, province, sharedStr, dataStr]);
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
    var owner = data[i][2];
    var sharedWith = data[i][4].toString().split(",");
    
    // Check if user is owner or in shared list
    if (owner === username || sharedWith.indexOf(username) !== -1) {
      projects.push({
        id: data[i][0],
        projectName: data[i][1],
        owner: owner,
        province: data[i][3],
        sharedWith: sharedWith,
        data: JSON.parse(data[i][5])
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
