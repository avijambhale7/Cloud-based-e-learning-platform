// ---------- Course Data ----------
const courses = [
  {
    id: 1, title: "Introduction to Cloud Computing", category: "Cloud", icon: "☁️",
    duration: "4 hours", desc: "Learn cloud basics: IaaS, PaaS, SaaS and deployment models.",
    video: "https://www.youtube.com/embed/M988_fsOSWo",
    lessons: ["What is Cloud Computing?", "Service Models (IaaS, PaaS, SaaS)", "Deployment Models", "Benefits and Challenges"]
  },
  {
    id: 2, title: "AWS for Beginners", category: "Cloud", icon: "🟧",
    duration: "6 hours", desc: "Get started with Amazon Web Services: EC2, S3 and more.",
    video: "https://www.youtube.com/embed/3hLmDS179YE",
    lessons: ["AWS Account Setup", "EC2 Virtual Machines", "S3 Storage", "IAM Users and Roles", "Hosting a Website"]
  },
  {
    id: 3, title: "Python Programming", category: "Programming", icon: "🐍",
    duration: "8 hours", desc: "Master Python from basics to functions and file handling.",
    video: "https://www.youtube.com/embed/_uQrJ0TkZlc",
    lessons: ["Variables and Data Types", "Conditions and Loops", "Functions", "Lists and Dictionaries", "File Handling"]
  },
  {
    id: 4, title: "HTML & CSS Basics", category: "Web", icon: "🌐",
    duration: "5 hours", desc: "Build beautiful web pages with HTML and CSS.",
    video: "https://www.youtube.com/embed/G3e-cpL7ofc",
    lessons: ["HTML Structure", "Text, Links and Images", "CSS Selectors", "Flexbox and Grid"]
  },
  {
    id: 5, title: "JavaScript Essentials", category: "Web", icon: "⚡",
    duration: "6 hours", desc: "Add interactivity to websites using JavaScript.",
    video: "https://www.youtube.com/embed/W6NZfCO5SIk",
    lessons: ["Variables and Functions", "DOM Manipulation", "Events", "Local Storage"]
  },
  {
    id: 6, title: "SQL & Databases", category: "Database", icon: "🗄️",
    duration: "5 hours", desc: "Understand relational databases and write SQL queries.",
    video: "https://www.youtube.com/embed/HXV3zeQKqGY",
    lessons: ["What is a Database?", "SELECT Queries", "INSERT, UPDATE, DELETE", "Joins", "Cloud Databases (RDS)"]
  }
];

// ---------- App State (saved in browser storage) ----------
let user = JSON.parse(localStorage.getItem("cl_user")) || null;
// progress = { courseId: [indexes of completed lessons] }
let progress = JSON.parse(localStorage.getItem("cl_progress")) || {};

function save() {
  localStorage.setItem("cl_user", JSON.stringify(user));
  localStorage.setItem("cl_progress", JSON.stringify(progress));
}

function isEnrolled(id) {
  return progress.hasOwnProperty(id);
}

function percent(course) {
  const done = (progress[course.id] || []).length;
  return Math.round((done / course.lessons.length) * 100);
}

// ---------- Render Courses ----------
function renderCourses() {
  const search = document.getElementById("searchBox").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const list = document.getElementById("courseList");

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search) &&
    (category === "all" || c.category === category)
  );

  if (filtered.length === 0) {
    list.innerHTML = "<p>No courses found.</p>";
    return;
  }

  list.innerHTML = filtered.map(c => `
    <div class="card">
      <div class="icon">${c.icon}</div>
      <span class="tag">${c.category}</span>
      <h3>${c.title}</h3>
      <p>${c.desc}</p>
      <p class="meta">⏱ ${c.duration} · 📚 ${c.lessons.length} lessons</p>
      <div class="actions">
        ${isEnrolled(c.id)
          ? `<button class="btn btn-green" onclick="openCourse(${c.id})">Continue</button>`
          : `<button class="btn" onclick="enroll(${c.id})">Enroll</button>`}
      </div>
    </div>
  `).join("");
}

// ---------- Render Dashboard ----------
function renderDashboard() {
  const welcome = document.getElementById("welcomeText");
  const myCourses = document.getElementById("myCourses");
  const enrolled = courses.filter(c => isEnrolled(c.id));

  welcome.textContent = user
    ? `Welcome back, ${user.name}! Here is your progress.`
    : "Please login to track your courses.";

  const completed = enrolled.filter(c => percent(c) === 100).length;
  const avg = enrolled.length
    ? Math.round(enrolled.reduce((sum, c) => sum + percent(c), 0) / enrolled.length)
    : 0;

  document.getElementById("enrolledCount").textContent = enrolled.length;
  document.getElementById("completedCount").textContent = completed;
  document.getElementById("avgProgress").textContent = avg + "%";

  if (!user || enrolled.length === 0) {
    myCourses.innerHTML = user ? "<p>You have not enrolled in any course yet.</p>" : "";
    return;
  }

  myCourses.innerHTML = enrolled.map(c => `
    <div class="card">
      <div class="icon">${c.icon}</div>
      <h3>${c.title}</h3>
      <div class="progress"><div class="progress-bar" style="width:${percent(c)}%"></div></div>
      <p class="meta">${percent(c)}% complete</p>
      <div class="actions">
        <button class="btn" onclick="openCourse(${c.id})">Open</button>
        <button class="btn btn-small" onclick="unenroll(${c.id})">Remove</button>
      </div>
    </div>
  `).join("");
}

function refresh() {
  renderCourses();
  renderDashboard();
}

// ---------- Actions ----------
function enroll(id) {
  if (!user) {
    alert("Please login first to enroll.");
    showModal("loginModal");
    return;
  }
  progress[id] = [];
  save();
  refresh();
  openCourse(id);
}

function unenroll(id) {
  if (confirm("Remove this course from your learning?")) {
    delete progress[id];
    save();
    refresh();
  }
}

function openCourse(id) {
  const c = courses.find(x => x.id === id);
  document.getElementById("modalTitle").textContent = c.title;
  document.getElementById("modalDesc").textContent = c.desc;
  document.getElementById("modalVideo").src = c.video;

  const done = progress[id] || [];
  document.getElementById("lessonList").innerHTML = c.lessons.map((lesson, i) => `
    <li>
      <label>
        <input type="checkbox" ${done.includes(i) ? "checked" : ""}
               onchange="toggleLesson(${id}, ${i}, this.checked)">
        Lesson ${i + 1}: ${lesson}
      </label>
    </li>
  `).join("");

  document.getElementById("modalProgress").style.width = percent(c) + "%";
  showModal("courseModal");
}

function toggleLesson(courseId, index, checked) {
  const done = progress[courseId] || [];
  progress[courseId] = checked ? [...done, index] : done.filter(i => i !== index);
  save();

  const c = courses.find(x => x.id === courseId);
  document.getElementById("modalProgress").style.width = percent(c) + "%";
  if (percent(c) === 100) alert(`🎉 Congratulations! You completed "${c.title}".`);
  refresh();
}

// ---------- Login ----------
function updateLoginButton() {
  document.getElementById("loginBtn").textContent = user ? "Logout" : "Login";
}

document.getElementById("loginBtn").onclick = () => {
  if (user) {
    user = null;
    progress = {};
    save();
    updateLoginButton();
    refresh();
  } else {
    showModal("loginModal");
  }
};

document.getElementById("submitLogin").onclick = () => {
  const name = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  if (!name || !email.includes("@")) {
    alert("Please enter a valid name and email.");
    return;
  }
  user = { name, email };
  save();
  hideModal("loginModal");
  updateLoginButton();
  refresh();
};

// ---------- Modals ----------
function showModal(id) {
  document.getElementById(id).classList.add("show");
}

function hideModal(id) {
  document.getElementById(id).classList.remove("show");
  if (id === "courseModal") document.getElementById("modalVideo").src = ""; // stop video
}

document.querySelectorAll(".close").forEach(btn => {
  btn.onclick = () => hideModal(btn.dataset.close);
});

window.onclick = e => {
  if (e.target.classList.contains("modal")) hideModal(e.target.id);
};

// ---------- Init ----------
document.getElementById("searchBox").oninput = renderCourses;
document.getElementById("categoryFilter").onchange = renderCourses;
updateLoginButton();
refresh();
