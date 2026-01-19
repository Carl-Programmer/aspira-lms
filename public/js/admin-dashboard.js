// ====== CONFIG & HELPERS ======
const API = '/api';
const token = localStorage.getItem('aspira_token');
if (!token) location.href = 'login.html';

async function api(path, opt = {}) {
  opt.headers = {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    ...(opt.headers || {})
  };
  const res = await fetch(API + path, opt);
  return res;
}
const q = (s, root = document) => root.querySelector(s);
const qa = (s, root = document) => Array.from(root.querySelectorAll(s));
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');
const openModal = (id) => { q(id).style.display = 'flex'; };
const closeModal = (id) => { q(id).style.display = 'none'; };
qa('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));

q('#logoutBtn').onclick = () => { localStorage.removeItem('aspira_token'); location.href = 'login.html'; };
q('#collapseBtn').onclick = () => q('#sidebar').classList.toggle('collapsed');

// ====== NAV / VIEWS ======
const views = {
  dashboard: q('#view-dashboard'),
  users: q('#view-users'),
  courses: q('#view-courses'),
  announcements: q('#view-announcements'),
};
function switchView(name) {
  Object.values(views).forEach(hide);
  show(views[name]);
  // load per view
  if (name === 'dashboard') loadDashboard();
  if (name === 'users') loadUsers();
  if (name === 'courses') loadCourses();
  if (name === 'announcements') loadAnnouncements();
}
qa('.navlink').forEach(a => a.addEventListener('click', (e) => {
  e.preventDefault();
  const v = a.getAttribute('data-view');
  switchView(v);
}));

// quick jumps
q('#gotoCourses')?.addEventListener('click', () => switchView('courses'));
q('#gotoAnnouncements')?.addEventListener('click', () => switchView('announcements'));

// ====== CURRENT USER / ROLE BADGE ======
let currentUser = null;
(async function getMe(){
  try {
    const r = await api('/me');
    if (r.ok) {
      currentUser = await r.json();
      q('#roleBadge').textContent = currentUser?.role ? currentUser.role.toUpperCase() : '';
      // hide Users tab if not admin
      if (currentUser?.role !== 'admin') {
        const usersLink = qa('.navlink').find(n => n.dataset.view === 'users');
        usersLink?.classList.add('pointer-events-none','opacity-40');
      }
    }
  } catch(e){}
})();

// ====== DASHBOARD ======
async function loadDashboard() {
  // Stats
  const [usersRes, coursesRes, annsRes] = await Promise.all([
    api('/users'),
    api('/courses'),
    api('/announcements')
  ]);

  const users = usersRes.ok ? await usersRes.json() : [];
  const courses = coursesRes.ok ? await coursesRes.json() : [];
  const anns = annsRes.ok ? await annsRes.json() : [];

  // Numbers
  q('#statUsers').textContent = users.length;
  q('#statTeachers').textContent = users.filter(u => u.role === 'teacher').length;
  q('#statStudents').textContent = users.filter(u => u.role === 'student').length;
  q('#statCourses').textContent = courses.length;

  // Recent courses cards
  q('#recentCourses').innerHTML = courses.slice(-4).reverse().map(c => `
    <div class="border rounded-lg p-3">
      <div class="font-medium">${c.title}</div>
      <div class="text-sm opacity-70">${c.description || ''}</div>
      <div class="text-xs opacity-60 mt-1">Teacher: ${c.teacher?.firstname ?? ''} ${c.teacher?.lastname ?? ''}</div>
    </div>
  `).join('') || `<div class="text-sm opacity-70">No courses yet.</div>`;

  // Announcements list (latest 5)
  q('#latestAnnouncements').innerHTML = anns.slice(-5).reverse().map(a => `
    <div class="border rounded-lg p-3">
      <div class="font-medium">${a.title}</div>
      <div class="text-sm opacity-70">${(a.message || '').slice(0,120)}${(a.message && a.message.length>120)?'…':''}</div>
      <div class="text-xs opacity-60 mt-1">${new Date(a.createdAt || a.updatedAt || Date.now()).toLocaleString()}</div>
    </div>
  `).join('') || `<div class="text-sm opacity-70">No announcements yet.</div>`;

  // ===== Replace Chart with Simple Courses Table =====
  try {
    const tableBodyId = 'coursesTableBody';
    let tableBody = document.getElementById(tableBodyId);
    if (!tableBody) {
      // Create table dynamically if not existing in HTML
      const container = q('#recentCourses');
      container.insertAdjacentHTML('beforebegin', `
  <div class="overflow-y-auto overflow-x-auto mt-4 max-h-64 rounded-lg border border-gray-200">
    <table class="min-w-full text-sm bg-white">
            <thead class="bg-rose-700 text-white sticky top-0 z-10">
              <tr>
                <th class="px-3 py-2 text-left">Course Title</th>
                <th class="px-3 py-2 text-left">Description</th>
                <th class="px-3 py-2 text-center">Students Enrolled</th>
                <th class="px-3 py-2 text-left">Teacher</th>
              </tr>
            </thead>
            <tbody id="${tableBodyId}" class="divide-y divide-gray-100 bg-white"></tbody>
          </table>
        </div>
      `);
      tableBody = document.getElementById(tableBodyId);
    }

    tableBody.innerHTML = '';

    if (!courses || courses.length === 0) {
      tableBody.innerHTML = `
        <tr><td colspan="4" class="text-center py-4 text-gray-500">No courses available.</td></tr>
      `;
    } else {
      courses.slice(0, 10).forEach(c => {
        const enrolled = Array.isArray(c.students) ? c.students.length : 0;
        const teacher = c.teacher ? `${c.teacher.firstname || ''} ${c.teacher.lastname || ''}`.trim() : '—';
        const desc = c.description ? c.description.substring(0, 40) + (c.description.length > 40 ? '…' : '') : '—';

        tableBody.innerHTML += `
          <tr class="hover:bg-rose-50">
            <td class="px-3 py-2">${c.title || 'Untitled'}</td>
            <td class="px-3 py-2 text-gray-600">${desc}</td>
            <td class="px-3 py-2 text-center font-medium">${enrolled}</td>
            <td class="px-3 py-2 text-gray-600">${teacher}</td>
          </tr>
        `;
      });
    }
  } catch (err) {
    console.error('Table error:', err);
  }
}

// ====== USERS (ADMIN ONLY) ======
const userModal = q('#userModal');
let editingUserId = null;

q('#addUserBtn')?.addEventListener('click', () => {
  editingUserId = null;
  q('#userModalTitle').textContent = 'Add User';
  q('#u_firstname').value = '';
  q('#u_lastname').value = '';
  q('#u_email').value = '';
  q('#u_password').value = '';
  q('#u_role').value = 'student';
  openModal('#userModal');
});

q('#saveUser')?.addEventListener('click', async () => {
  const body = {
    firstname: q('#u_firstname').value.trim(),
    lastname: q('#u_lastname').value.trim(),
    email: q('#u_email').value.trim(),
    role: q('#u_role').value
  };
  const pass = q('#u_password').value.trim();
  if (!editingUserId && !pass) return alert('Password required for new user.');
  if (pass) body.password = pass;

  const res = await api('/users' + (editingUserId ? '/' + editingUserId : ''), {
    method: editingUserId ? 'PUT' : 'POST',
    body: JSON.stringify(body)
  });
  if (!res.ok) { alert('Failed to save user'); return; }
  closeModal('#userModal'); loadUsers();
});

async function loadUsers(){
  const res = await api('/users');
  const users = res.ok ? await res.json() : [];
  const list = q('#usersList');
  const empty = q('#usersEmpty');

  if (!users.length) { list.innerHTML = ''; show(empty); return; }
  hide(empty);
  list.innerHTML = users.map(u => `
    <div class="p-3 flex items-center justify-between">
      <div>
        <div class="font-medium">${u.firstname} ${u.lastname}</div>
        <div class="text-sm opacity-70">${u.email} • ${u.role}</div>
      </div>
      <div class="flex gap-2">
        <button class="editUser px-3 py-1 rounded-md bg-gray-100 text-sm" data-id="${u._id}">Edit</button>
        ${
          u.role === 'admin' 
          ?''//no promote/demote for admins
          : u.role === 'teacher'
          ? `<button class="demote px-3 py-1 rounded-md bg-gray-100 text-sm" data-id="${u._id}">Demote</button>`
          : `<button class="promote px-3 py-1 rounded-md bg-gray-100 text-sm" data-id="${u._id}">Promote</button>`}
        <button class="deleteUser px-3 py-1 rounded-md bg-red-600 text-white text-sm" data-id="${u._id}">Delete</button>
      </div>
    </div>
  `).join('');

  qa('.editUser', list).forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    const u = users.find(x => x._id === id);
    if (!u) return;
    editingUserId = id;
    q('#userModalTitle').textContent = 'Edit User';
    q('#u_firstname').value = u.firstname || '';
    q('#u_lastname').value = u.lastname || '';
    q('#u_email').value = u.email || '';
    q('#u_password').value = '';
    q('#u_role').value = u.role || 'student';
    openModal('#userModal');
  });
  qa('.promote', list).forEach(b => b.onclick = async () => {
    await api('/users/' + b.dataset.id + '/promote', { method:'POST' }); loadUsers(); loadDashboard();
  });
  qa('.demote', list).forEach(b => b.onclick = async () => {
    await api('/users/' + b.dataset.id + '/demote', { method:'POST' }); loadUsers(); loadDashboard();
  });
  qa('.deleteUser', list).forEach(b => b.onclick = async () => {
    if (!confirm('Delete this user?')) return;
    const r = await api('/users/' + b.dataset.id, { method:'DELETE' });
    if (r.ok) { loadUsers(); loadDashboard(); } else alert('Delete failed');
  });
}

// ====== COURSES (ADMIN/TEACHER) ======
// ====== COURSES (ADMIN/TEACHER) ======
const courseModal = q('#courseModal');

let editingCourseId = null;


// Load teacher list into dropdown
async function populateTeachers() {
  const teacherSelect = q('#c_teacher');
  teacherSelect.innerHTML = `<option value="">-- Select Teacher --</option>`;
  try {
    const res = await api('/users');
    const users = res.ok ? await res.json() : [];
    const teachers = users.filter(u => u.role === 'teacher');
    teachers.forEach(t => {
      teacherSelect.innerHTML += `<option value="${t._id}">${t.firstname} ${t.lastname}</option>`;
    });
  } catch (err) {
    console.error('Error loading teachers:', err);
  }
}

// Open Add Course Modal
q('#addCourseBtn')?.addEventListener('click', async () => {
  editingCourseId = null;
  q('#courseModalTitle').textContent = 'Add Course';
  q('#c_title').value = '';
  q('#c_desc').value = '';
  await populateTeachers(); // load teacher dropdown
  q('#c_teacher').value = '';
  openModal('#courseModal');
});

// Save Course (Create or Edit)
q('#saveCourse')?.addEventListener('click', async () => {
  const title = q('#c_title').value.trim();
  if (!title) return alert('Title is required');
  const description = q('#c_desc').value.trim();
  const teacher = q('#c_teacher').value;

  const body = { title, description };
  if (teacher) body.teacher = teacher; // include teacher ID

  const res = await api('/courses' + (editingCourseId ? '/' + editingCourseId : ''), {
    method: editingCourseId ? 'PUT' : 'POST',
    body: JSON.stringify(body)
  });
  if (!res.ok) return alert('Failed to save course');
  closeModal('#courseModal'); loadCourses(); loadDashboard();
});

// Load Courses List
// Load Courses List
async function loadCourses() {
  const res = await api('/courses');
  const courses = res.ok ? await res.json() : [];
  const list = q('#coursesList');
  const empty = q('#coursesEmpty');

  if (!courses.length) {
    list.innerHTML = '';
    show(empty);
    return;
  }

  hide(empty);
  list.innerHTML = courses.map(c => `
    <div class="p-3 flex items-center justify-between">
      <div>
        <div class="font-medium">${c.title}</div>
        <div class="text-sm opacity-70">${c.description || ''}</div>
        <div class="text-xs opacity-60 mt-1">
          Teacher: ${c.teacher?.firstname ?? ''} ${c.teacher?.lastname ?? ''} • 
          Students: ${(c.students || []).length}
        </div>
      </div>
      <div class="flex gap-2">
        <button class="viewCourse px-3 py-1 rounded-md bg-blue-600 text-white text-sm" data-id="${c._id}">View</button>
        <button class="editCourse px-3 py-1 rounded-md bg-gray-100 text-sm"
          data-id="${c._id}"
          data-title="${c.title}"
          data-desc="${c.description || ''}"
          data-teacher="${c.teacher?._id || ''}">
          Edit
        </button>
        <button class="deleteCourse px-3 py-1 rounded-md bg-red-600 text-white text-sm" data-id="${c._id}">Delete</button>
        <button class="attendanceBtn px-3 py-1 rounded-md bg-rose-700 text-white text-sm" data-id="${c._id}">Attendance</button>
      </div>
    </div>
  `).join('');

  // ===== Edit Course =====
  qa('.editCourse', list).forEach(b => b.onclick = async () => {
    editingCourseId = b.dataset.id;
    q('#courseModalTitle').textContent = 'Edit Course';
    q('#c_title').value = b.dataset.title || '';
    q('#c_desc').value = b.dataset.desc || '';
    await populateTeachers();
    q('#c_teacher').value = b.dataset.teacher || '';
    openModal('#courseModal');
  });

  // ===== Delete Course =====
  qa('.deleteCourse', list).forEach(b => b.onclick = async () => {
    if (!confirm('Delete this course?')) return;
    const r = await api('/courses/' + b.dataset.id, { method: 'DELETE' });
    if (r.ok) {
      loadCourses();
      loadDashboard();
    } else alert('Delete failed');
  });

  // ===== Attendance (Admin/Teacher) =====
  qa('.attendanceBtn', list).forEach(b => {
    b.onclick = () => {
      currentCourseId = b.dataset.id;
      console.log('🧾 Opening attendance for course:', currentCourseId);
      openAttendance(currentCourseId); // ✅ show modal + load attendance
    };
  });


// View Course Details
qa('.viewCourse', list).forEach(b => b.onclick = async () => {
  const courseId = b.dataset.id;
  const res = await api(`/courses/${courseId}`);
  if (!res.ok) return alert('Failed to load course details');
  const course = await res.json();

  // Populate modal
  q('#v_title').textContent = course.title || '—';
  q('#v_desc').textContent = course.description || '—';
  q('#v_teacher').textContent = course.teacher 
    ? `${course.teacher.firstname || ''} ${course.teacher.lastname || ''}`.trim() 
    : '—';

  // Students
  const studentList = q('#v_students');
  studentList.innerHTML = (course.students && course.students.length)
    ? course.students.map(s => `<li>${s.firstname} ${s.lastname}</li>`).join('')
    : `<li class="text-gray-500">No students enrolled</li>`;

  // Contents (with delete button)
const contentList = q('#v_contents');
contentList.innerHTML = (course.contents && course.contents.length)
  ? course.contents.map(c => `
      <li class="flex justify-between items-center">
        <a href="${c.file.startsWith('/uploads') ? c.file : '/uploads/contents/' + c.file}" 
   target="_blank" 
   class="text-blue-600 underline">
   ${c.title}
</a>

        <button class="deleteContent text-xs text-red-600" data-id="${c._id}">Delete</button>
      </li>
    `).join('')
  : `<li class="text-gray-500">No content uploaded</li>`;

  currentCourseId = course._id;

openModal('#viewCourseModal');


// Handle delete buttons
qa('.deleteContent').forEach(btn => {
  btn.onclick = async () => {
    if (!confirm('Delete this content?')) return;
    const r = await api(`/courses/${course._id}/content/${btn.dataset.id}`, { method: 'DELETE' });
    if (r.ok) {
      alert('Content deleted');
      closeModal('#viewCourseModal');
      loadCourses(); // refresh the course list
    } else {
      alert('Failed to delete content');
    }
  };
});

});

// --- Content Management for Admins ---
const addBtn = q('#addContentBtn');
const form = q('#addContentForm');
const cancelBtn = q('#cancelContent');
const saveBtn = q('#saveContent');
let uploading = false;

// Show form
addBtn.onclick = () => { form.classList.remove('hidden'); };

// Cancel form
cancelBtn.onclick = () => { 
  form.classList.add('hidden'); 
  q('#content_title').value = ''; 
  q('#content_file').value = '';
};

// Save content
saveBtn.onclick = async () => {
  if (uploading) return;
  const title = q('#content_title').value.trim();
  const file = q('#content_file').files[0];
  if (!title || !file) return alert('Title and file required.');

  uploading = true;
  const fd = new FormData();
  fd.append('title', title);
  fd.append('file', file);

  const res = await fetch(`${API}/courses/${currentCourseId}/content`, {

    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: fd
  });
  uploading = false;

  if (!res.ok) return alert('Failed to upload content.');

  alert('Content added successfully!');
  form.classList.add('hidden');
  q('#content_title').value = ''; 
  q('#content_file').value = '';
  loadCourses(); // refresh courses list
  closeModal('#viewCourseModal');
};

// --- Enroll Student ---
// --- Enroll Student (Smart Search) ---
const enrollBtn = q('#enrollStudentBtn');
const enrollForm = q('#enrollForm');
const cancelEnroll = q('#cancelEnroll');
const confirmEnroll = q('#confirmEnroll');
const studentSearch = q('#studentSearch');
const suggestions = q('#studentSuggestions');
let selectedStudent = null;

enrollBtn.onclick = () => {
  enrollForm.classList.remove('hidden');
  studentSearch.focus();
};

cancelEnroll.onclick = () => {
  enrollForm.classList.add('hidden');
  studentSearch.value = '';
  suggestions.classList.add('hidden');
};

// 🔍 Smart search as you type
studentSearch.addEventListener('input', async () => {
  const query = studentSearch.value.trim();
  selectedStudent = null;
  if (query.length < 2) {
    suggestions.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(`/api/users?email=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;

    const users = await res.json();
    const students = users.filter(u => u.role === 'student');
    if (!students.length) {
      suggestions.innerHTML = `<div class="p-2 text-sm text-gray-500">No students found</div>`;
    } else {
      suggestions.innerHTML = students.map(s => `
        <div class="p-2 text-sm hover:bg-rose-50 cursor-pointer border-b"
             data-id="${s._id}" data-name="${s.firstname} ${s.lastname}">
          ${s.firstname} ${s.lastname} <span class="text-gray-500 text-xs">(${s.email})</span>
        </div>
      `).join('');
    }
    suggestions.classList.remove('hidden');
  } catch (err) {
    console.error('Search error:', err);
  }
});

// 🧩 Click suggestion
suggestions.addEventListener('click', (e) => {
  const item = e.target.closest('[data-id]');
  if (!item) return;
  selectedStudent = { id: item.dataset.id, name: item.dataset.name };
  studentSearch.value = item.dataset.name;
  suggestions.classList.add('hidden');
});

// ➕ Enroll the selected student
confirmEnroll.onclick = async () => {
  if (!selectedStudent) return alert('Please select a student.');

  try {
    const r = await fetch(`/api/courses/${currentCourseId}/add-student`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ studentId: selectedStudent.id })
    });

    if (r.ok) {
      alert(`✅ ${selectedStudent.name} enrolled successfully!`);
      studentSearch.value = '';
      suggestions.classList.add('hidden');
      enrollForm.classList.add('hidden');
      loadCourses();
    } else {
      alert('❌ Failed to enroll student.');
    }
  } catch (err) {
    console.error('Error enrolling student:', err);
  }
};




}


// ====== ANNOUNCEMENTS (ADMIN/TEACHER) ======
const annModal = q('#annModal');
let editingAnnId = null;

q('#addAnnouncementBtn')?.addEventListener('click', () => {
  editingAnnId = null;
  q('#annModalTitle').textContent = 'New Announcement';
  q('#a_title').value = '';
  q('#a_body').value = '';
  openModal('#annModal');
});

q('#saveAnnouncement')?.addEventListener('click', async () => {
  const title = q('#a_title').value.trim();
  const body = q('#a_body').value.trim();
  if (!title) return alert('Title required');

  const res = await api('/announcements' + (editingAnnId ? '/' + editingAnnId : ''), {
    method: editingAnnId ? 'PUT' : 'POST',
    body: JSON.stringify({ title, body })
  });
  if (!res.ok) return alert('Failed to save announcement');
  closeModal('#annModal'); loadAnnouncements(); loadDashboard();
});

async function loadAnnouncements(){
  const res = await api('/announcements');
  const anns = res.ok ? await res.json() : [];
  const list = q('#announcementsList');
  const empty = q('#annEmpty');

  if (!anns.length) { list.innerHTML = ''; show(empty); return; }
  hide(empty);
  list.innerHTML = anns.slice().reverse().map(a => {
  const safeTitle = a.title ? a.title.replace(/"/g, '&quot;') : '';
  const safeMessage = encodeURIComponent(a.message || '');
  return `
    <div class="p-3 flex items-start justify-between gap-3">
      <div>
        <div class="font-medium">${a.title}</div>
        <div class="text-sm opacity-80 whitespace-pre-line">${a.message || ''}</div>
        <div class="text-xs opacity-60 mt-1">
          ${new Date(a.createdAt || a.updatedAt || Date.now()).toLocaleString()}
        </div>
      </div>
      <div class="flex gap-2">
        <button 
          class="editAnn px-3 py-1 rounded-md bg-gray-100 text-sm"
          data-id="${a._id}" 
          data-title="${safeTitle}" 
          data-body="${safeMessage}">
          Edit
        </button>
        <button 
          class="deleteAnn px-3 py-1 rounded-md bg-red-600 text-white text-sm"
          data-id="${a._id}">
          Delete
        </button>
      </div>
    </div>
  `;
}).join('');



qa('.editAnn', list).forEach(b => b.onclick = () => {
  editingAnnId = b.dataset.id;
  q('#annModalTitle').textContent = 'Edit Announcement';
  q('#a_title').value = b.dataset.title || '';
  q('#a_body').value = decodeURIComponent(b.dataset.body || '');
  openModal('#annModal');
});

  qa('.deleteAnn', list).forEach(b => b.onclick = async () => {
    if (!confirm('Delete this announcement?')) return;
    const r = await api('/announcements/' + b.dataset.id, { method:'DELETE' });
    if (r.ok) { loadAnnouncements(); loadDashboard(); } else alert('Delete failed');
  });
}

// ====== ATTENDANCE (ADMIN/TEACHER) ======
async function openAttendance(courseId) {

  
  
  // always fetch fresh data (no caching)
  const res = await api(`/attendance/${courseId}?_=${Date.now()}`);
  const sessions = res.ok ? await res.json() : [];
  const lastSession = sessions.at(-1);

  const courseRes = await api(`/courses/${courseId}?_=${Date.now()}`);

  const course = courseRes.ok ? await courseRes.json() : null;
  if (!course) return alert('Course not found.');

  const container = q('#attendanceList');
  container.innerHTML = course.students.map(s => {
    const prev = lastSession?.records?.find(r => {
  const sid = typeof r.student === 'object' ? r.student._id : r.student;
  return sid === s._id;
});

    const status = prev?.status || 'Absent';
    return `
      <div class="flex justify-between p-2 border-b">
        <span>${s.firstname} ${s.lastname}</span>
        <select data-id="${s._id}" class="border rounded p-1">
          <option ${status === 'Present' ? 'selected' : ''}>Present</option>
          <option ${status === 'Absent' ? 'selected' : ''}>Absent</option>
          <option ${status === 'Late' ? 'selected' : ''}>Late</option>
          <option ${status === 'Excused' ? 'selected' : ''}>Excused</option>
        </select>
      </div>
    `;
  }).join('');

  console.log('Opening attendance modal...');
q('#attendanceModal').style.display = 'flex';


  // ✅ SAVE attendance
  q('#saveAttendance').onclick = async () => {
    const records = qa('#attendanceList select').map(sel => ({
      student: sel.dataset.id,
      status: sel.value
    }));
    const date = q('#att_date').value || new Date();
    const r = await api(`/attendance/${courseId}/mark`, {
      method: 'POST',
      body: JSON.stringify({ date, records })
    });
    alert(r.ok ? '✅ Attendance saved!' : '❌ Failed to save attendance.');
    q('#attendanceModal').style.display = 'none';
  };

// ✅ RECOVER attendance
const recoverBtn = q('#recoverAttendanceBtn');
if (recoverBtn) {
  recoverBtn.onclick = async () => {
    const date = q('#att_date').value;
    if (!date) return alert('Please select a date to recover.');

    const r = await api(`/attendance/${courseId}/recover`, {
      method: 'POST',
      body: JSON.stringify({ date }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      alert(err.msg || 'No attendance found for that date.');
      return;
    }

    const data = await r.json();
    populateRecoveredAttendance(data.record?.records || []);
    alert(`✅ Recovered attendance for ${new Date(data.record.date).toLocaleDateString()}`);
  };
}
}

// === Helper to populate recovered records ===
function populateRecoveredAttendance(records = []) {
  const container = q('#attendanceList');
  container.innerHTML = '';

  if (!records.length) {
    container.innerHTML = `<div class="text-sm text-gray-500 text-center p-3">No records found for this date.</div>`;
    return;
  }

records.forEach(r => {
  const name =
    r.student
      ? `${r.student.firstname || ''} ${r.student.lastname || ''}`.trim()
      : '(Deleted Student)'; // ✅ fallback

  container.innerHTML += `
    <div class="flex items-center justify-between px-3 py-2 border-b">
      <span>${name}</span>
      <span class="text-sm font-medium">${r.status}</span>
    </div>
  `;
});

}


// ====== INIT ======
switchView('dashboard');
