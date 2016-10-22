#!/usr/bin/env node
// transpile:testwa

import { getLogger } from 'appium-logger';
import path from 'path';
import uuid from 'uuid-js';
import {fs, mkdirp} from 'appium-support';
import { util } from 'appium-support';
import { utils } from 'appium-uiauto';
import { retry } from 'asyncbox';
// import {JSON5} from 'json5';

let logger = getLogger("TestWa");
let logData = getLogger("TestWaData");

let  temp = require('temp')
    , _ = require('underscore')
    ,testwaresponse = require('./middleware.js')
    ,testData = require('./testcasedata.js')
    ,async = require('async')
    ,stringify = require('json-stringify-safe')
    ,ncp = require('ncp').ncp
    ,querystring = require("querystring");//testwa

let testwa = {};
let screenIndex=0;
let op_alue = "";
let memoryinfo = "0";
let cpurate = "0";
let packagename = "";
let sessionid = "";
let testsuit = "";
let testcaseid = "";
let deviceid = "";
let genTool = false;

testwa.heartbeat = function (args) {
    if (args.waHeartbeat) {
        var returnStatus = {status: 0};
        //use testwaDeviceId instead of udid for MAC
        if (args.udid) {
            testwaresponse.SendStartStatus(returnStatus, args.udid, args.testcaselogId, args.port);
        }
        else {
            testwaresponse.SendStartStatus(returnStatus, args.testwaDeviceId, args.testcaselogId, args.port);
        }
    }
};

testwa.responseNoDriver = function (driver, req, httpStatus, httpResBody, commond, jsonObj) {
    let args = driver.args;

    let testDataReply = _.clone(testData);
    testDataReply.testdata.description = "No Driver found for this session, probably appium error, please restart appium!";
    if (args.genTool) {
        // console.log(testDataReply);
        logData.error(stringify(testDataReply));
    } else {
        testwaresponse.SendDataNativeApp(testDataReply.testdata)
    }
};

testwa.responseDeleteSession = function (driver, req, httpStatus, httpResBody, commond, jsonObj) {
    let testDataReply = _.clone(testData);
    testDataReply.testdata.status = 0;
    testDataReply.testdata.value = httpResBody.value;
    testDataReply.testdata.runtime = 0;
    testDataReply.testdata.sessionId = httpResBody.sessionId;
    testDataReply.testdata.deviceId = deviceid;
    testDataReply.testdata.testSuit = testsuit;
    testDataReply.testdata.testcaseId = testcaseid;
    testDataReply.testdata.command = {"action": "停止测试", "params": ""};
    testDataReply.testdata.screenshotPath = "";

    let myDate = new Date();
    let endTime = myDate.getTime();
    testDataReply.runtime = endTime - req._startTime.getTime();
    testDataReply.status = httpResBody.status;
    if (null !== httpResBody.value) {
        testDataReply.description = httpResBody.value.message ? httpResBody.value.message : "";
    }


    if (genTool) {
        // console.log(testDataReply);
        logData.error(stringify(testDataReply));
    } else {
        testwaresponse.SendDataNativeApp(testDataReply.testdata);
    }
};

testwa.handler = async function (driver,req,httpStatus,httpResBody,commond,jsonObj) {
    if (commond !== 'deleteSession') {
        if (driver.sessions[httpResBody.sessionId]) {
            if (driver.sessions[httpResBody.sessionId].constructor.name === 'AndroidDriver') {
                //Android device
                await testwa.getActionAndroid(driver, req, httpStatus, httpResBody, commond, jsonObj);
            }
            else {
                //IOS device
                await testwa.getActionIOS(driver, req, httpStatus, httpResBody, commond, jsonObj);
            }
        } else {
            //no driver found , response error
            testwa.responseNoDriver(driver, req, httpStatus, httpResBody, commond, jsonObj);
        }
    } else {
        //deleteSession
        testwa.responseDeleteSession(driver,req,httpStatus,httpResBody,commond,jsonObj);
    }
};

//Android driver
testwa.getTranslationAction = function (commond, jsonObj) {
    if (commond === "createSession") {
        return ["创建会话",""];
    } else if (commond === "findElements") {
        return ["查找元素（"+jsonObj.using+"）",jsonObj.value];
    } else if(commond === "findElement") {
        return ["查找元素（"+jsonObj.using+"）",jsonObj.value];
    } else if (commond === "click") {
        return ["点击",""];
    } else if (commond === "setValue") {
        return ["输入",jsonObj.value.join("")];
    } else if (commond === "implicitWait") {
        return ["等待",jsonObj.ms+"ms"];
    } else if (commond === "getWindowSize") {
        return ["获取屏幕大小",""];
    } else if (commond === "performTouch") {
        if (jsonObj.actions.length === 1) {
            let action = jsonObj.actions[0];
            if (action.action === "longPress") {
                let options = action.options;
                return ["长按","(x:"+options.x+",y:"+options.y+")"+options.duration+"ms"];
            }
        } else if (jsonObj.actions.length === 4) {
            let action1 = jsonObj.actions[0];
            let action3 = jsonObj.actions[2];
            if (action1.action === "press" && action3.action === "moveTo") {
                let options1 = action1.options;
                let options3 = action3.options;
                return ["滑屏","从(x:"+options1.x+",y:"+options1.y+")到(x:"+options3.x+",y:"+options3.y+")"];
            }
        }
    }

    return [commond,jsonObj.value];
};
testwa.genRsp = function (driver, req, httpStatus, httpResBody,action,param,cpuRate,memoryInfo) {
    let Driver = driver.sessions[httpResBody.sessionId];
    let caps = Driver.caps;
    let args = driver.args;

    let testDataReply = _.clone(testData);
    testDataReply.testdata.status = httpStatus;
    testDataReply.testdata.value = httpResBody.value;
    testDataReply.testdata.runtime = 0;
    testDataReply.testdata.cpurate = cpuRate ? cpuRate:"0";
    testDataReply.testdata.memory = memoryInfo ? memoryInfo:"0";
    testDataReply.testdata.sessionId = httpResBody.sessionId;
    testDataReply.testdata.deviceId = deviceid = caps ? caps.deviceName : "";
    testDataReply.testdata.testSuit = testsuit = caps ? caps.testSuit : "";
    testDataReply.testdata.testcaseId = testcaseid = caps ? caps.testcaseId : "";
    testDataReply.testdata.command = {"action": action, "params": param};

    let myDate = new Date();
    let endTime = myDate.getTime();
    testDataReply.testdata.runtime = endTime - req._startTime.getTime();
    testDataReply.testdata.status = httpResBody.status;
    if (null !== httpResBody.value) {
        testDataReply.testdata.description = httpResBody.value.message ? httpResBody.value.message : "";
    }

    return [testDataReply,endTime];
};
testwa.outputLogcat = function (Driver) {
    let adb = Driver.adb;
    if(adb && querystring.stringify(adb.logcat) !== null) {
        console.log("[to-server-logcat-start]");
        console.log(adb.logcat.getLogs());
        console.log("[to-server-logcat-end]");
    }
};
testwa.getActionAndroid = async function(driver,req,httpStatus,httpResBody,commond,jsonObj){
    let Driver = driver.sessions[httpResBody.sessionId];
    let caps = Driver.caps;
    let args = driver.args;
    genTool = args.genTool;
    // let action = commond;
    // let param = jsonObj.value ? jsonObj.value:jsonObj.ms;

    let [action,param] = this.getTranslationAction(commond,jsonObj);

    let [memoryInfo,cpuRate] = await this.getPerformance(Driver,httpResBody);

    let [testDataReply,endTime] = testwa.genRsp(driver,req,httpStatus,httpResBody,action,param,cpuRate,memoryInfo);

    let screenshotPath = args ? args.screenshotPath :"";
    let tempPng = screenshotPath+"/"+endTime+".png";
    await testwa.getScreenshotAndroid(Driver,tempPng);
    testDataReply.testdata.screenshotPath = endTime+".png";

    if (args.genTool) {
        // console.log(testDataReply);
        logData.error(stringify(testDataReply));
    } else {
        testwa.outputLogcat(Driver);
        testwaresponse.SendDataNativeApp(testDataReply.testdata);
    }
};

testwa.getActionIOS = async function (driver, req, httpStatus, httpResBody, commond, jsonObj) {
    //only difference between ios and android is not getting performance.
    let Driver = driver.sessions[httpResBody.sessionId];
    let caps = Driver.caps;
    let args = driver.args;
    genTool = args.genTool;

    let [action,param] = this.getTranslationAction(commond,jsonObj);

    let [testDataReply,endTime] = testwa.genRsp(driver,req,httpStatus,httpResBody,action,param,0,0);
    let screenshotPath = args ? args.screenshotPath : "";

    if (Driver.constructor.name === 'XCUITestDriver') {
        await this.getXcuitestScreenshot(Driver, screenshotPath, httpResBody.sessionId, endTime);
    } else {
        // let tempPng = screenshotPath + "/" + endTime + ".png";
        await testwa.getScreenshotIOS(Driver,screenshotPath, endTime+".png");
    }
    testDataReply.testdata.screenshotPath = endTime+".png";

    if (args.genTool) {
        // console.log(testDataReply);
        logData.error(stringify(testDataReply));
    } else {
        testwaresponse.SendDataNativeApp(testDataReply.testdata);
    }
};

//get memoryinfo and cpurate
testwa.getPerformance = async function (androidDriver,httpResBody) {
    logger.debug("Getting device memeory and cpu cost!");
    let adb = androidDriver.adb;
    let caps = androidDriver.caps;
    let appName = caps.appPackage;
    let out = await adb.shell("top -n 1 -d 0.5 | grep "+appName);
    let reg_MEM = /[0-9]{1,9}([K])/g;
    let reg_CPU = /[0-9]{1,2}([%])/g;
    let memarray  = out.match(reg_MEM);
    let tmpcpurate  = out.match(reg_CPU);
    let memoryinfo = memarray[1];
    memoryinfo = memoryinfo.replace('K','');
    let cpurate = tmpcpurate[0];
    cpurate = cpurate.replace('%','');
    return [memoryinfo,cpurate];
};

testwa.getScreenshotAndroid = async function (androidDriver, tempPng) {
    const png = '/data/local/tmp/screenshot.png';
    let cmd =  ['/system/bin/rm', `${png};`, '/system/bin/screencap', '-p', png];
    await androidDriver.adb.shell(cmd);
    if (await fs.exists(tempPng)) {
        await fs.unlink(tempPng);
    }
    await androidDriver.adb.pull(png, tempPng);
};

testwa.getXcuitestScreenshot = async function (Driver, screenshotPath, sessionId, endTime) {
    let [response, body] = await Driver.wda.jwproxy.proxy('/wd/hub/session/'+ sessionId +'/screenshot', 'get', null);
    body = util.safeJsonParse(body);
    await fs.writeFile(screenshotPath+"/"+endTime+".png", body.value, 'base64', (err) => {
        if (err) throw err;
    });
}

testwa.getScreenshotIOS = async function (Driver, screenshotPath, filename) {
    // let guid = uuid.create();
    // let shotFile = `screenshot${guid}`;

    let shotFolder = screenshotPath;
    if (!(await fs.exists(shotFolder))) {
        logger.debug(`Creating folder '${shotFolder}'`);
        await mkdirp(shotFolder);
    }

    let shotPath = path.resolve(shotFolder, filename);
    logger.debug(`Taking screenshot: '${shotPath}'`);

    let takeScreenShot = async () => {
        await this.uiAutoClient.sendCommand(`au.capture('${shotFile}')`);

        let screenshotWaitTimeout = (this.opts.screenshotWaitTimeout || 10) * 1000;
        logger.debug(`Waiting ${screenshotWaitTimeout} ms for screenshot to be generated.`);
        let startMs = Date.now();

        let success = false;
        while ((Date.now() - startMs) < screenshotWaitTimeout) {
            if (await fs.hasAccess(shotPath)) {
                success = true;
                break;
            }
            await B.delay(300);
        }
        if (!success) {
            throw new Error('Timed out waiting for screenshot file');
        }

        // check the rotation, and rotate if necessary
        if (await this.getOrientation() === 'LANDSCAPE') {
            logger.debug('Rotating landscape screenshot');
            await utils.rotateImage(shotPath, -90);
        }

        ncp(shotFolder,temp,function (err) {
            if (err) {
                return logger.error(err);
            }
            logger.log('screenshot done!');});

        return;
    };
};

module.exports = testwa;