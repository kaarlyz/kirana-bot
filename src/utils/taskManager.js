const fs = require('fs');
const config = require('../config/config');

function loadTasks() {
  if (!fs.existsSync(config.tasksFile)) {
    fs.writeFileSync(config.tasksFile, JSON.stringify({ tasks: [] }));
    return { tasks: [] };
  }
  return JSON.parse(fs.readFileSync(config.tasksFile));
}

function saveTasks(tasks) {
  fs.writeFileSync(config.tasksFile, JSON.stringify(tasks, null, 2));
}

module.exports = { loadTasks, saveTasks };
