/**
 * Created by yxin on 7/12/2017.
 */
let execSync = require('child_process').execSync
    , spawnSync = require('child_process').spawnSync
    , endOfLine = require('os').EOL;

let testwa = {};

testwa.initBatteryStatsAndroid = function (driver, osDriver) {
  driver.battery = {
    android: {},
    battery: 0,
    appNetworkStats: {
      received: 0,
      sent: 0
    }
  };
  driver.battery.android.adbPath = osDriver.adb.sdkRoot + '/platform-tools/adb';
  driver.battery.android.package = osDriver.opts.appPackage;
  driver.battery.android.deviceId = osDriver.opts.deviceName;
  osDriver.adb.shell(['dumpsys', 'battery', 'unplug']);
};

testwa.getBatteryStatsDeleteSession = function (driver) {
  if (driver.battery && driver.battery.android) {
    // android battery stats
    let adbPath = driver.battery.android.adbPath;
    let deviceId = driver.battery.android.deviceId;
    execSync(`${adbPath} -s ${deviceId} shell dumpsys battery reset`);
    testwa.adbDumpBatterystats(driver, adbPath, false);
    return [driver.battery.battery, driver.battery.appNetworkStats];
  }

  return [null, null];
};

testwa.adbDumpBatterystats = function (driver, adbPath, reset) {
  let deviceId = driver.battery.android.deviceId;
  let out = spawnSync(adbPath, ['-s', deviceId, 'shell', 'dumpsys', 'batterystats', '--charged', '--checkin']);
  let batteryStatsStr = out.stdout.toString('utf8');
  // console.log(out.stdout.toString('utf8'));
  if (reset) {
    execSync(`${adbPath} -s ${deviceId} shell dumpsys batterystats --reset`);
  }
  let [battery, appNetworkStats] = testwa.parseBatteryStatsForPackage(batteryStatsStr, driver.battery.android.package);
  driver.battery.battery += battery;
  driver.battery.appNetworkStats.received += appNetworkStats.received;
  driver.battery.appNetworkStats.sent += appNetworkStats.sent;
};

testwa.parseBatteryStatsForPackage = function (statsStr, appPackage) {
  let statsArray = statsStr.split(endOfLine);
  let uid;
  let totalPower;
  let appUsedPower;
  let appUsedNetwork = {received: 0, sent: 0};
  let battery = 0;
  for (let line of statsArray) {
    let trimLine = line.trim();
    let cols = trimLine.split(',');
    if (cols.indexOf(appPackage) > -1) {
      uid = cols[4];
    }
    if (cols.indexOf('pws') > -1) {
      totalPower = +cols[4];
    }
    if (uid && cols.indexOf(uid) > -1 && cols.indexOf('pwi') > -1) {
      appUsedPower = +cols[cols.length - 1];
    }
    if (uid && cols.indexOf(uid) > -1 && cols.indexOf('nt') > -1) {
      appUsedNetwork = {
        received: +cols[6],
        sent: +cols[7]
      };
    }
  }
  if (totalPower && appUsedPower) {
    battery = appUsedPower / totalPower;
  }
  return [battery, appUsedNetwork];
};

export default testwa;