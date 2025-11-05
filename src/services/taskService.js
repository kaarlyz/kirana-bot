const fs = require('fs').promises;
const path = require('path');

const tasksFile = path.join(__dirname, '../../tasks.json');

async function initTasksFile() {
  try {
    await fs.access(tasksFile);
  } catch {
    await fs.writeFile(tasksFile, JSON.stringify({ tasks: [] }, null, 2));
  }
}

async function readAll() {
  await initTasksFile();
  const data = await fs.readFile(tasksFile, 'utf8');
  return JSON.parse(data).tasks || [];
}

async function writeAll(tasks) {
  await fs.writeFile(tasksFile, JSON.stringify({ tasks }, null, 2));
}

async function getTasks(filter = 'all') {
  const tasks = await readAll();
  const now = new Date();
  switch (filter) {
    case 'today': {
      const today = now.toISOString().split('T')[0];
      return tasks.filter(t => (t.deadline || '').startsWith(today));
    }
    case 'completed':
      return tasks.filter(t => t.status === 'completed');
    case 'overdue':
      return tasks.filter(t => t.status === 'pending' && new Date(t.deadline) < now);
    default:
      return tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }
}

async function addTask(taskData) {
  const tasks = await readAll();

  // normalize deadline if possible
  let normalizedDeadline = taskData.deadline;
  if (taskData.deadline) {
    const d = new Date(taskData.deadline);
    if (!isNaN(d.getTime())) {
      normalizedDeadline = d.toISOString().split('T')[0];
    }
  }

  const newTask = {
    id: Date.now(),
    mapel: taskData.mapel,
    deskripsi: taskData.deskripsi,
    deadline: normalizedDeadline,
    file: taskData.file || null,
    createdBy: taskData.createdBy || null,
    status: taskData.status || 'pending',
    priority: taskData.priority || 'normal',
    category: taskData.category || 'other',
    progress: taskData.progress || 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reminders: taskData.reminders || []
  };
  tasks.push(newTask);
  await writeAll(tasks);
  return newTask;
}

async function getTaskById(id) {
  const tasks = await readAll();
  return tasks.find(t => t.id === id) || null;
}

async function updateTaskStatus(taskId, status) {
  const tasks = await readAll();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return null;
  if (task.status === status) {
    // no change -> return current task without writing file
    return task;
  }
  task.status = status;
  if (status === 'completed') task.progress = 100;
  task.updatedAt = new Date().toISOString();
  await writeAll(tasks);
  return task;
}

async function updateTaskProgress(taskId, progress) {
  const tasks = await readAll();
  const t = tasks.find(x => x.id === taskId);
  if (!t) return null;
  t.progress = Math.min(100, Math.max(0, progress));
  if (t.progress === 100) t.status = 'completed';
  t.updatedAt = new Date().toISOString();
  await writeAll(tasks);
  return t;
}

async function deleteTask(taskId) {
  let tasks = await readAll();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  await writeAll(tasks);
  return true;
}

async function getTaskStats() {
  const tasks = await readAll();
  const now = new Date();
  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    dueToday: tasks.filter(t => (t.deadline || '').startsWith(now.toISOString().split('T')[0])).length,
    overdue: tasks.filter(t => t.status === 'pending' && new Date(t.deadline) < now).length
  };
}

async function getUpcomingDeadlines() {
  const tasks = await readAll();
  const now = new Date();
  return tasks.filter(t => {
    if (!t.deadline || t.status !== 'pending') return false;
    const diff = (new Date(t.deadline) - now) / (1000 * 60 * 60 * 24);
    return diff <= 1 && diff > 0;
  });
}

module.exports = {
  getTasks,
  addTask,
  getTaskById,
  updateTaskStatus,
  updateTaskProgress,
  deleteTask,
  getTaskStats,
  getUpcomingDeadlines
};
