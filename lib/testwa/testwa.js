#!/usr/bin/env node
// transpile:testwa

import {getLogger} from "appium-logger";
import path from "path";
import {fs, mkdirp, util} from "appium-support";
import {utils} from "appium-uiauto";
import {retry} from "asyncbox";

let logger = getLogger("TestWa");
let logData = getLogger("TestWaData");

let temp = require('temp')
    , _ = require('underscore')
    , testwaresponse = require('./middleware.js')
    , testData = require('./testcasedata.js')
    , async = require('async')
    , stringify = require('json-stringify-safe')
    // ,ncp = require('ncp').ncp
    , querystring = require("querystring")
    , endOfLine = require('os').EOL;

var fse = require('fs-extra');

const fileSystem = require('fs');

let testwa = {};
let testsuit = "";
let testcaseid = "";
let deviceid = "";
let reportPath = '';
let reportRelativePath = '../../../../../../report';
let reportListName = 'reportList';
let reportFileName = 'Test';
let reportFile = 'Test0';

function lineCount(file) {
    let data = fileSystem.readFileSync(file);
    return data.toString().split(endOfLine).length - 1;
}

function getReportFileName(reportPath, reportListName) {
    return fileSystem.existsSync(reportPath + '/resources/' + reportListName + '.json') ?
        reportFileName + lineCount(reportPath + '/resources/' + reportListName + '.json') :
        reportFileName + 0;
}

function initReportPath(driver) {
    reportPath = driver.args.reportPath ?
        driver.args.reportPath :
        path.resolve(__dirname, reportRelativePath);
}
testwa.initBaseDriver = function (driver) {
    //driver = android driver or ios
    initReportPath(driver);

    let Driver = driver.sessions[Object.keys(driver.sessions)[0]];
    let caps = Driver.caps;

    let reportEntity = driver.reportEntity;
    let reportList = reportEntity.reportList;
    let reportSummary = reportEntity.reportSummary;

    //handle date
    let date = new Date();
    let startTime = date.getTime();
    reportEntity.sessionStartTime = startTime;
    date = new Date(startTime);
    let startTimeStr = date.toISOString().replace(/T/, ' ').replace(/\..+/, '');
    reportList.sessionStartTime = startTimeStr;
    reportList.deviceName = caps.deviceName;
    reportList.apkName = caps.appPackage;
    reportSummary.deviceName = caps.deviceName;
    reportSummary.apkName = caps.appPackage;
    reportSummary.result = 0;

    reportFile = getReportFileName(reportPath, reportListName);
    reportList.fileName = reportFile;
    let listTemplatePath = path.resolve(__dirname, 'listTemplate');
    //copy listTemplate if not exist
    if (!fileSystem.existsSync(reportPath + '/index.html')) {
        // let listTemplatePath = path.resolve(__dirname, 'listTemplate');
        // ncp(listTemplatePath, reportPath, function (err) {
        //     if (err) {return logger.error(err);}
        // });
        try {
            fse.copySync(listTemplatePath, reportPath);
        } catch (err) {
            logger.error(err)
        }
    }
    //copy template to reportpath
    let templatePath = path.resolve(__dirname, 'template');
    // ncp(templatePath, reportPath+'/'+reportFile, function (err) {
    //     if (err) {return logger.error(err);}
    //     //init reportSteps.js
    //     fileSystem.writeFileSync(reportPath+'/'+reportFile+'/resources/reportSteps.js','var reportSteps = [ ');
    // });
    try {
        fse.copySync(templatePath, reportPath + '/' + reportFile);
        fileSystem.writeFileSync(reportPath + '/' + reportFile + '/resources/reportSteps.js', 'var reportSteps = [ ');
    } catch (err) {
        logger.error(err)
    }
};

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
        logData.error(stringify(testDataReply));
    } else {
        testwaresponse.SendDataNativeApp(testDataReply.testdata)
    }
};

function generateReportFinish(driver) {
    let reportEntity = driver.reportEntity;
    let reportList = reportEntity.reportList;
    let reportSummary = reportEntity.reportSummary;
    let date = new Date();
    let endTime = date.getTime();
    reportEntity.sessionEndTime = endTime;
    reportSummary.sessionTotalTime = reportEntity.sessionEndTime - reportEntity.sessionStartTime;

    //reportSteps.js
    fileSystem.appendFileSync(reportPath + '/' + reportFile + '/resources/reportSteps.js', '];');

    //reportSummary.js
    let summaryJs = 'var reportSummary = ' + stringify(reportSummary) + ' ;';
    fileSystem.writeFileSync(reportPath + '/' + reportFile + '/resources/reportSummary.js', summaryJs);
    fileSystem.writeFileSync(reportPath + '/' + reportFile + '/resources/reportSummary.json', stringify(reportSummary));

    //write reportList.json
    reportList.result = reportSummary.result;
    reportList.sessionTotalTime = reportSummary.sessionTotalTime;
    fileSystem.appendFileSync(reportPath + '/resources/' + reportListName + '.json', JSON.stringify(reportList) + endOfLine);
    //write reportList.js
    let reportListJs = '';
    reportListJs = fileSystem.readFileSync(reportPath + '/resources/' + reportListName + '.js', 'utf8');
    reportListJs = reportListJs.replace('var reportLists = [' + endOfLine, 'var reportLists = [' + endOfLine + JSON.stringify(reportList) + ',' + endOfLine);
    fileSystem.writeFileSync(reportPath + '/resources/' + reportListName + '.js', reportListJs);
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
    testDataReply.testdata.runtime = endTime - req._startTime.getTime();
    testDataReply.testdata.status = httpResBody.status;
    if (null !== httpResBody.value) {
        testDataReply.description = httpResBody.value.message ? httpResBody.value.message : "";
    }

    let args = driver.args;
    let genTool = args.genTool;
    let portal = args.portal;
    let report = args.report;
    // let tempPng = testDataReply.testdata.screenshotPath + '/' +endTime+'.png';

    if (genTool) {
        // logger.debug(testDataReply);
        logData.error(stringify(testDataReply));
        if (report) {
            generateReportSteps(testDataReply, "");
            generateReportFinish(driver);
        }
    } else if (portal) {
        testwaresponse.SendDataNativeApp(testDataReply.testdata);
        if (report) {
            generateReportSteps(testDataReply, "");
            generateReportFinish(driver);
        }
    }
};

testwa.handler = async function (driver, req, httpStatus, httpResBody, command, jsonObj) {
    if (command !== 'deleteSession' && command !== 'createSession') {
        if (driver.sessions[httpResBody.sessionId]) {
            let platformName = driver.sessions[httpResBody.sessionId].caps.platformName.toLowerCase();
            if ('android' === platformName) {
                //Android device
                logger.debug('Testwa android device handler')
                await testwa.getActionAndroid(driver, req, httpStatus, httpResBody, command, jsonObj);
            }
            else if ('ios' === platformName) {
                //IOS device
                logger.debug('Testwa ios device handler')
                await testwa.getActionIOS(driver, req, httpStatus, httpResBody, command, jsonObj);
            }
            else {
                logger.debug('Testwa no supported device : ' + platformName);
            }
        } else if (command) {
            //No command here probably checking status, so skip
            logger.debug('No command here so skip!')
        } else {
            //no driver found , response error
            logger.debug('No Android/IOSDriver found here! Please restart Appium!')
            testwa.responseNoDriver(driver, req, httpStatus, httpResBody, command, jsonObj);
        }
    } else if (command === 'deleteSession') {
        //deleteSession
        logger.debug('Delete Session!')
        testwa.responseDeleteSession(driver, req, httpStatus, httpResBody, command, jsonObj);
    }
};

//Android driver
testwa.getTranslationAction = function (commond, jsonObj) {
    if (commond === "createSession") {
        return ["创建会话", ""];
    } else if (commond === "findElements") {
        return ["查找元素（" + jsonObj.using + "）", jsonObj.value];
    } else if (commond === "findElement") {
        if ('check' === jsonObj.mode) {
            return ["检查元素（" + jsonObj.using + "）", jsonObj.value, jsonObj.mode, jsonObj.note];
        }
        return ["查找元素（" + jsonObj.using + "）", jsonObj.value];
    } else if (commond === "click") {
        return ["点击", ""];
    } else if (commond === "setValue" || commond === "inputValue") {
        return ["输入", jsonObj.value.join("")];
    } else if (commond === "pressKeyCode") {
        return ["输入", `输入keycode: ${jsonObj.keycode}`];
    } else if (commond === "implicitWait") {
        return ["等待", jsonObj.ms + "ms"];
    } else if (commond === "getWindowSize") {
        return ["获取屏幕大小", ""];
    } else if (commond === "performTouch") {
        if (jsonObj.actions.length === 1) {
            let action = jsonObj.actions[0];
            if (action.action === "longPress") {
                let options = action.options;
                return ["长按", "(x:" + options.x + ",y:" + options.y + ")" + options.duration + " ms"];
            } else if (action.action === "tap") {
                let options = action.options;
                return ["点击", "(x:" + options.x + ",y:" + options.y + ")"];
            }
        } else if (jsonObj.actions.length === 4) {
            let action1 = jsonObj.actions[0];
            let action3 = jsonObj.actions[2];
            if (action1.action === "press" && action3.action === "moveTo") {
                let options1 = action1.options;
                let options3 = action3.options;
                return ["滑屏", "从(x:" + options1.x + ",y:" + options1.y + ")到(x:" + options3.x + ",y:" + options3.y + ")"];
            }
        }
    } else if (commond === "installApp") {
        return ["安装应用", `安装本地应用 ：${jsonObj.appPath}`];
    } else if (commond === "startActivity") {
        return ["启动应用", `启动应用 ： ${jsonObj.appPackage}`];
    } else if (commond === "removeApp") {
        return ["卸载应用", `卸载应用 ：${jsonObj.appId}`];
    }


    return [commond, jsonObj.value];
};
testwa.genRsp = function (driver, req, httpStatus, httpResBody, action, param, commandMode, commandNotes, cpuRate, memoryInfo) {
    let Driver = driver.sessions[httpResBody.sessionId];
    let caps = Driver.caps;
    let args = driver.args;

    let testDataReply = _.clone(testData);
    testDataReply.testdata.status = httpStatus;
    testDataReply.testdata.value = httpResBody.value;
    testDataReply.testdata.runtime = 0;
    testDataReply.testdata.cpurate = cpuRate ? cpuRate : "0";
    testDataReply.testdata.memory = memoryInfo ? memoryInfo : "0";
    testDataReply.testdata.sessionId = httpResBody.sessionId;
    testDataReply.testdata.deviceId = deviceid = caps ? caps.deviceName : "";
    testDataReply.testdata.testSuit = testsuit = caps ? caps.testSuit : "";
    testDataReply.testdata.testcaseId = testcaseid = caps ? caps.testcaseId : "";
    testDataReply.testdata.command = {"action": action, "params": param};
    if (commandMode) {
        testDataReply.testdata.command.mode = commandMode;
    }
    if (commandNotes) {
        testDataReply.testdata.command.note = commandNotes;
    }

    let myDate = new Date();
    let endTime = myDate.getTime();
    if (action === "启动应用") {
        testDataReply.testdata.runtime = Driver.adb.appLaunchTotalTime;
    } else {
        testDataReply.testdata.runtime = endTime - req._startTime.getTime();
    }

    testDataReply.testdata.status = httpResBody.status;
    if (null !== httpResBody.value) {
        testDataReply.testdata.description = httpResBody.value.message ? httpResBody.value.message : "";
    }

    return [testDataReply, endTime];
};

//use another way getting logcat
testwa.outputLogcat = function (Driver) {
    let adb = Driver.adb;
    if (adb && querystring.stringify(adb.logcat) !== null) {
        console.log("[to-server-logcat-start]");
        console.log(adb.logcat.getLogs());
        console.log("[to-server-logcat-end]");
    }
};

function generateReportSteps(testDataReply, tempPng) {
    testDataReply.testdata.screenshotPath = tempPng;
    let jsonStr = stringify(testDataReply);
    fileSystem.appendFileSync(reportPath + '/' + reportFile + '/resources/reportSteps.json', jsonStr + endOfLine);
    fileSystem.appendFileSync(reportPath + '/' + reportFile + '/resources/reportSteps.js', jsonStr + ',' + endOfLine);
}

function reportReply(report, testDataReply, tempPng) {
    if (report) {
        generateReportSteps(testDataReply, tempPng);
        testDataReply.testdata.status == 0 ? null :
            driver.reportEntity.reportSummary.result = 1;
    }
}
function replyAction(driver, args, testDataReply, tempPng) {
    let genTool = args.genTool;
    let portal = args.portal;
    let report = args.report;
    if (genTool) {
        // console.log(testDataReply);
        logData.error(stringify(testDataReply));
        reportReply(report, testDataReply, tempPng);
    } else if (portal) {
        // testwa.outputLogcat(Driver);
        testwaresponse.SendDataNativeApp(testDataReply.testdata);
        reportReply(report, testDataReply, tempPng);
    }
}
testwa.getActionAndroid = async function (driver, req, httpStatus, httpResBody, command, jsonObj) {
    let Driver = driver.sessions[httpResBody.sessionId];
    let caps = Driver.caps;
    let args = driver.args;
    // let action = command;
    // let param = jsonObj.value ? jsonObj.value:jsonObj.ms;

    let [action, param, commandMode, commandNotes] = this.getTranslationAction(command, jsonObj);

    let [memoryInfo, cpuRate] = await this.getPerformance(Driver, httpResBody);

    let [testDataReply, endTime] = testwa.genRsp(driver, req, httpStatus, httpResBody, action, param, commandMode, commandNotes, cpuRate, memoryInfo);

    let screenshotPath = args ? args.screenshotPath : "";
    let tempPng = screenshotPath + "/" + endTime + ".png";
    await testwa.getScreenshotAndroid(Driver, tempPng);
    testDataReply.testdata.screenshotPath = endTime + ".png";

    replyAction(driver, args, testDataReply, tempPng);
};

testwa.getActionIOS = async function (driver, req, httpStatus, httpResBody, commond, jsonObj) {
    //only difference between ios and android is not getting performance.
    let Driver = driver.sessions[httpResBody.sessionId];
    let caps = Driver.caps;
    let args = driver.args;

    let [action, param, commandMode, commandNotes] = this.getTranslationAction(commond, jsonObj);

    let [testDataReply, endTime] = testwa.genRsp(driver, req, httpStatus, httpResBody, action, param, commandMode, commandNotes, 0, 0);
    let screenshotPath = args ? args.screenshotPath : "";
    let mode = Driver.caps.automationName.toLowerCase();
    if (mode === 'xcuitest') {
        logger.debug("Screen shot with XCUITest!")
        await this.getXcuitestScreenshot(Driver, screenshotPath, httpResBody.sessionId, endTime);
    } else {
        // let tempPng = screenshotPath + "/" + endTime + ".png";
        // await testwa.getScreenshotIOS(Driver,screenshotPath, endTime+".png");
        logger.debug("No support for none XCUITest mode yet!")
    }
    testDataReply.testdata.screenshotPath = endTime + ".png";

    let tempPng = screenshotPath + '/' + endTime + ".png";

    replyAction(driver, args, testDataReply, tempPng)
};

//get memoryinfo and cpurate
testwa.getPerformance = async function (androidDriver, httpResBody) {
    logger.debug("Getting device memeory and cpu cost!");
    let adb = androidDriver.adb;
    let caps = androidDriver.caps;
    let appName = caps.appPackage;
    try {
        let out = await adb.shell("top -n 1 -d 0.5 | grep " + appName);
        let reg_MEM = /[0-9]{1,9}([K])/g;
        let reg_CPU = /[0-9]{1,2}([%])/g;
        let memarray = out.match(reg_MEM);
        let tmpcpurate = out.match(reg_CPU);
        let memoryinfo = memarray[1];
        memoryinfo = memoryinfo.replace('K', '');
        let cpurate = tmpcpurate[0];
        cpurate = cpurate.replace('%', '');
        return [memoryinfo, cpurate];
    } catch (e) {
        logger.debug("Error Getting cpu and memory info!");
        // logger.debug(e);
        return [0, 0];
    }
};

testwa.getScreenshotAndroid = async function (androidDriver, tempPng) {
    const png = '/data/local/tmp/screenshot.png';
    let cmd = ['/system/bin/rm', `${png};`, '/system/bin/screencap', '-p', png];
    await androidDriver.adb.shell(cmd);
    if (await fs.exists(tempPng)) {
        await fs.unlink(tempPng);
    }
    await androidDriver.adb.pull(png, tempPng);
};

testwa.getXcuitestScreenshot = async function (Driver, screenshotPath, sessionId, endTime) {
    let [response, body] = await Driver.wda.jwproxy.proxy('/wd/hub/session/' + sessionId + '/screenshot', 'get', null);
    body = util.safeJsonParse(body);
    await fs.writeFile(screenshotPath + "/" + endTime + ".png", body.value, 'base64', (err) => {
        if (err) throw err;
    });
};

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

        // ncp(shotFolder,temp,function (err) {
        //     if (err) {
        //         return logger.error(err);
        //     }
        //     logger.log('screenshot done!');
        // });

        try {
            fse.copySync(temp, shotFolder);
        } catch (err) {
            logger.error(err)
        }

        return;
    };
};

module.exports = testwa;