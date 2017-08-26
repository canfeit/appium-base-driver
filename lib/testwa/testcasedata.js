"use strict";

exports.testdata = {
    status: 0,
    value: '', // 暂时没有用
    runtime: '',
    cpurate:0,
    memory:0,
    battery: null, //电量使用率,于结束测试时获取
    // network: {
    //     sent: null,
    //     received: null
    // }, 流量，于结束测试时获取
    sessionId: '',
    deviceId: '', //机器的sn号
    testSuit: '',   //desired caps, 脚本ID
    testcaseId: '', //desired caps, case ID
    executionTaskId: '', // desired caps, task ID
    screenshotPath: '',//png file name
    description:'',
    command: ''
};