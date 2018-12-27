import sessionCmds from './session';
import settingsCmds from './settings';

let testwa = {};
Object.assign(
  commands,
  sessionCmds,
  settingsCmds,
  timeoutCmds,
  findCmds
  // add other command types here
);

export default commands;
