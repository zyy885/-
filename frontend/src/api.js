const BASE = '/api';

function getToken() {
  return localStorage.getItem('vocab_token');
}

export function setAuth(token, user) {
  localStorage.setItem('vocab_token', token);
  localStorage.setItem('vocab_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('vocab_token');
  localStorage.removeItem('vocab_user');
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('vocab_user'));
  } catch {
    return null;
  }
}

function handleAuthError() {
  clearAuth();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  const token = getToken();
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(BASE + path, opts);
    if (res.status === 401) {
      handleAuthError();
      throw new Error('登录已过期，请重新登录');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || (res.status === 502 ? '服务器正在部署，请稍后再试' : '请求失败 (' + res.status + ')'));
    }
    return data;
  } catch (e) {
    if (e.message === 'Failed to fetch' || e.message.includes('NetworkError')) {
      throw new Error('网络连接失败，请检查网络');
    }
    throw e;
  }
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  register: (username, password) => request('POST', '/auth/register', { username, password }),
  me: () => request('GET', '/me'),
  getStudents: () => request('GET', '/students'),
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  deleteUser: (id) => request('DELETE', '/users/' + id),
  resetUserPassword: (id, password) => request('PUT', `/users/${id}/password`, { password }),
  getUserRankInfo: (id) => request('GET', `/users/${id}/rank-info`),
  updateUserRankBonus: (id, data) => request('PUT', `/users/${id}/rank-bonus`, data),
  getWordBooks: () => request('GET', '/word-books'),
  createWordBook: (data) => request('POST', '/word-books', data),
  updateWordBook: (id, data) => request('PUT', '/word-books/' + id, data),
  deleteWordBook: (id) => request('DELETE', '/word-books/' + id),
  getWordLists: (wordBookId) => request('GET', '/word-lists' + (wordBookId ? '?word_book_id=' + wordBookId : '')),
  createWordList: (data) => request('POST', '/word-lists', data),
  updateWordList: (id, data) => request('PUT', '/word-lists/' + id, data),
  deleteWordList: (id) => request('DELETE', '/word-lists/' + id),
  getWords: (listId) => request('GET', `/word-lists/${listId}/words`),
  addWord: (listId, data) => request('POST', `/word-lists/${listId}/words`, data),
  insertWord: (listId, data) => request('POST', `/word-lists/${listId}/words/insert`, data),
  updateWord: (id, data) => request('PUT', '/words/' + id, data),
  deleteWord: (id) => request('DELETE', '/words/' + id),
  getTasks: () => request('GET', '/tasks'),
  createTask: (data) => request('POST', '/tasks', data),
  deleteTask: (id) => request('DELETE', '/tasks/' + id),
  getTaskProgress: (id) => request('GET', `/tasks/${id}/progress`),
  getStudyWords: (taskId) => request('GET', `/tasks/${taskId}/study`),
  saveStudyRecord: (data) => request('POST', '/study-records', data),
  getTestWords: (taskId) => request('GET', `/tasks/${taskId}/test-words`),
  submitTest: (data) => request('POST', '/tests/submit', data),
  getTestResult: (taskId) => request('GET', `/tasks/${taskId}/test-result`),
  changePassword: (oldPassword, newPassword) => request('PUT', '/me/password', { oldPassword, newPassword }),
  getFavorites: () => request('GET', '/favorites'),
  addFavorite: (word_id) => request('POST', '/favorites', { word_id }),
  deleteFavorite: (word_id) => request('DELETE', '/favorites/' + word_id),
  getWrongBook: (sort) => request('GET', '/wrong-book' + (sort ? '?sort=' + sort : '')),
  getMyStats: () => request('GET', '/stats/me'),
  getLeaderboard: () => request('GET', '/leaderboard'),
  batchCreateUsers: (users) => request('POST', '/users/batch', { users }),
  exportTaskScores: (taskId) => {
    const token = getToken();
    window.open(`/api/tasks/${taskId}/export?token=${encodeURIComponent(token || '')}`, '_blank');
  },
  resetTaskStudent: (tsId) => request('POST', '/task-students/' + tsId + '/reset'),
  exportWordList: (listId) => {
    const token = getToken();
    return fetch(`/api/word-lists/${listId}/export?token=${encodeURIComponent(token || '')}`).then(r => r.json());
  },
  exportSentenceList: (listId) => {
    const token = getToken();
    return fetch(`/api/sentence-lists/${listId}/export?token=${encodeURIComponent(token || '')}`).then(r => r.json());
  },
  importWordList: (data) => request('POST', '/word-lists/import', data),
  importWordsToList: (listId, data) => request('POST', `/word-lists/${listId}/import`, data),
  getComments: () => request('GET', '/comments'),
  addComment: (data) => request('POST', '/comments', data),
  deleteComment: (id) => request('DELETE', '/comments/' + id),
  getSettings: () => request('GET', '/settings'),
  saveSettings: (data) => request('PUT', '/settings', data),
  getSentenceLists: () => request('GET', '/sentence-lists'),
  createSentenceList: (data) => request('POST', '/sentence-lists', data),
  updateSentenceList: (id, data) => request('PUT', '/sentence-lists/' + id, data),
  deleteSentenceList: (id) => request('DELETE', '/sentence-lists/' + id),
  getSentences: (listId) => request('GET', `/sentence-lists/${listId}/sentences`),
  addSentence: (listId, data) => request('POST', `/sentence-lists/${listId}/sentences`, data),
  updateSentence: (id, data) => request('PUT', '/sentences/' + id, data),
  deleteSentence: (id) => request('DELETE', '/sentences/' + id),
  exportSentenceList: (listId) => fetch(`/api/sentence-lists/${listId}/export`, { headers: { Authorization: 'Bearer ' + getToken() } }).then(r => r.json()),
  importSentenceList: (data) => request('POST', '/sentence-lists/import', data),
  submitTranslation: (data) => request('POST', '/translation/submit', data),
  getTranslationRecords: () => request('GET', '/translation/records'),
  getTestRecords: (tsId) => request('GET', `/task-students/${tsId}/test-records`),
  updateTestRecord: (recId, is_correct) => request('PUT', `/test-records/${recId}`, { is_correct }),
  getCheckinStatus: () => request('GET', '/checkins/status'),
  doCheckin: () => request('POST', '/checkins'),
  getCheckins: () => request('GET', '/checkins'),
  getAllCheckins: (date) => request('GET', `/checkins/all${date ? '?date=' + date : ''}`),
  getTags: () => request('GET', '/tags'),
  createTag: (data) => request('POST', '/tags', data),
  updateTag: (id, data) => request('PUT', '/tags/' + id, data),
  deleteTag: (id) => request('DELETE', '/tags/' + id),
  getStudentTags: (studentId) => request('GET', `/students/${studentId}/tags`),
  setStudentTags: (studentId, tag_ids) => request('POST', `/students/${studentId}/tags`, { tag_ids }),
  getTagStudents: (tagId) => request('GET', `/tags/${tagId}/students`),
  getSelfTestWords: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/self-tests/words?${qs}`);
  },
  submitSelfTest: (data) => request('POST', '/self-tests/submit', data),
  getSelfTests: () => request('GET', '/self-tests'),
  getStudyStats: () => request('GET', '/study-stats'),
  trackStudySession: (data) => request('POST', '/study-sessions/track', data),
  updateAvatar: (avatar) => request('PUT', '/me/avatar', { avatar }),
};
