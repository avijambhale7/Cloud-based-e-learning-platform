// =====================================================
// CloudLearn - frontend logic
// Uses Supabase (Auth + PostgreSQL) when config.js has keys,
// otherwise runs in demo mode with browser localStorage.
// =====================================================

const cfg = window.CLOUDLEARN_CONFIG || {};
// Accept the URL even if "/rest/v1/" was pasted on the end
const supabaseUrl = (cfg.SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const useSupabase = Boolean(supabaseUrl && cfg.SUPABASE_ANON_KEY && window.supabase);
const sb = useSupabase ? window.supabase.createClient(supabaseUrl, cfg.SUPABASE_ANON_KEY) : null;

// ---------- State ----------
let courses = [];
let user = null; // { id, name, email }
let progress = {}; // { courseId: [completed lesson indexes] }
let category = "All";
let authMode = "login";
let loadError = ""; // shown in the course list if courses fail to load

const $ = id => document.getElementById(id);

// Escape text before putting it into HTML
const esc = s =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Safe localStorage helpers (may be blocked in private mode)
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};

// ---------- Demo course data (used when Supabase is not set up) ----------
const DEMO_COURSES = [
  { id: 1, title: "Introduction to Cloud Computing", category: "Cloud", level: "Beginner", icon: "☁️", duration: "4 hours",
    description: "Learn cloud basics: IaaS, PaaS, SaaS and deployment models.", video_url: "https://www.youtube.com/embed/M988_fsOSWo",
    lessons: ["What is Cloud Computing?", "Service Models (IaaS, PaaS, SaaS)", "Deployment Models", "Benefits and Challenges"] },
  { id: 2, title: "AWS for Beginners", category: "Cloud", level: "Beginner", icon: "🟧", duration: "6 hours",
    description: "Get started with Amazon Web Services: EC2, S3 and more.", video_url: "https://www.youtube.com/embed/3hLmDS179YE",
    lessons: ["AWS Account Setup", "EC2 Virtual Machines", "S3 Storage", "IAM Users and Roles", "Hosting a Website"] },
  { id: 3, title: "Python Programming", category: "Programming", level: "Beginner", icon: "🐍", duration: "8 hours",
    description: "Master Python from basics to functions and file handling.", video_url: "https://www.youtube.com/embed/_uQrJ0TkZlc",
    lessons: ["Variables and Data Types", "Conditions and Loops", "Functions", "Lists and Dictionaries", "File Handling"] },
  { id: 4, title: "HTML & CSS Basics", category: "Web", level: "Beginner", icon: "🌐", duration: "5 hours",
    description: "Build beautiful web pages with HTML and CSS.", video_url: "https://www.youtube.com/embed/G3e-cpL7ofc",
    lessons: ["HTML Structure", "Text, Links and Images", "CSS Selectors", "Flexbox and Grid"] },
  { id: 5, title: "JavaScript Essentials", category: "Web", level: "Intermediate", icon: "⚡", duration: "6 hours",
    description: "Add interactivity to websites using JavaScript.", video_url: "https://www.youtube.com/embed/W6NZfCO5SIk",
    lessons: ["Variables and Functions", "DOM Manipulation", "Events", "Fetching Data from APIs"] },
  { id: 6, title: "SQL & Databases", category: "Database", level: "Intermediate", icon: "🗄️", duration: "5 hours",
    description: "Understand relational databases and write SQL queries.", video_url: "https://www.youtube.com/embed/HXV3zeQKqGY",
    lessons: ["What is a Database?", "SELECT Queries", "INSERT, UPDATE, DELETE", "Joins", "Cloud Databases (Supabase / Postgres)"] },
];

// ---------- Backend API ----------
// Both versions have the same functions, so the rest of the app
// doesn't care where the data lives.
const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const supabaseApi = {
  async getCourses() {
    return check(await sb.from("courses").select("*").order("id"));
  },
  async getProgress() {
    const rows = check(await sb.from("enrollments").select("course_id, completed_lessons"));
    return Object.fromEntries(rows.map(r => [r.course_id, r.completed_lessons || []]));
  },
  async enroll(courseId) {
    check(await sb.from("enrollments").insert({ course_id: courseId }));
  },
  async unenroll(courseId) {
    check(await sb.from("enrollments").delete().eq("course_id", courseId));
  },
  async saveLessons(courseId, lessons) {
    check(await sb.from("enrollments").update({ completed_lessons: lessons }).eq("course_id", courseId));
  },
  async signUp(name, email, password) {
    const data = check(await sb.auth.signUp({ email, password, options: { data: { full_name: name } } }));
    return Boolean(data.session); // false = email confirmation required
  },
  async signIn(email, password) {
    check(await sb.auth.signInWithPassword({ email, password }));
  },
  async signOut() {
    await sb.auth.signOut();
  },
};

const demoApi = {
  async getCourses() {
    return DEMO_COURSES;
  },
  async getProgress() {
    return store.get("cl_progress_" + user.email, {});
  },
  async enroll(courseId) {
    progress[courseId] = [];
    store.set("cl_progress_" + user.email, progress);
  },
  async unenroll(courseId) {
    delete progress[courseId];
    store.set("cl_progress_" + user.email, progress);
  },
  async saveLessons(courseId, lessons) {
    progress[courseId] = lessons;
    store.set("cl_progress_" + user.email, progress);
  },
  async signUp(name, email, password) {
    const users = store.get("cl_users", {});
    if (users[email]) throw new Error("An account with this email already exists.");
    users[email] = { name, password }; // demo only: never store passwords like this in a real app
    store.set("cl_users", users);
    await setUser({ id: email, name, email });
    return true;
  },
  async signIn(email, password) {
    const account = store.get("cl_users", {})[email];
    if (!account || account.password !== password) throw new Error("Invalid email or password.");
    await setUser({ id: email, name: account.name, email });
  },
  async signOut() {
    await setUser(null);
  },
};

const api = useSupabase ? supabaseApi : demoApi;

// ---------- Helpers ----------
function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = message;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

const isEnrolled = id => Object.prototype.hasOwnProperty.call(progress, id);

function percent(course) {
  if (!course.lessons.length) return 0;
  const done = (progress[course.id] || []).length;
  return Math.round((done / course.lessons.length) * 100);
}

async function busy(button, task) {
  button.disabled = true;
  try {
    await task();
  } catch (err) {
    let message = err.message || "Something went wrong.";
    if (/rate limit/i.test(message)) {
      message = "Too many sign ups right now. Please wait a few minutes and try again.";
    } else if (/email not confirmed/i.test(message)) {
      message = "Please confirm your email first (check your inbox), then login.";
    }
    toast(message, "error");
  } finally {
    button.disabled = false;
  }
}

// ---------- Rendering ----------
function renderCategories() {
  const cats = ["All", ...new Set(courses.map(c => c.category))];
  $("categoryChips").innerHTML = cats
    .map(c => `<button class="chip ${c === category ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
    .join("");
}

function courseCard(c, inDashboard = false) {
  const p = percent(c);
  const enrolled = isEnrolled(c.id);
  const thumbClass = ["Cloud", "Programming", "Web", "Database"].includes(c.category) ? c.category : "default";

  let buttons;
  if (inDashboard) {
    buttons = `
      <button class="btn" data-open="${c.id}">${p === 100 ? "Review" : "Continue"}</button>
      <button class="btn btn-ghost" data-unenroll="${c.id}">Remove</button>`;
  } else if (enrolled) {
    buttons = `<button class="btn btn-green" data-open="${c.id}">${p === 100 ? "✓ Completed" : "Continue →"}</button>`;
  } else {
    buttons = `<button class="btn" data-enroll="${c.id}">Enroll Free</button>`;
  }

  return `
    <div class="card">
      <div class="card-thumb thumb-${thumbClass}">
        ${esc(c.icon)}
        ${p === 100 ? '<span class="done-badge">🎓 Completed</span>' : ""}
      </div>
      <div class="card-body">
        <div class="tags">
          <span class="tag">${esc(c.category)}</span>
          <span class="tag level">${esc(c.level)}</span>
        </div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.description)}</p>
        ${enrolled
          ? `<div class="progress"><div class="progress-bar" style="width:${p}%"></div></div>
             <p class="meta">${p}% complete · ${(progress[c.id] || []).length}/${c.lessons.length} lessons</p>`
          : `<p class="meta">⏱ ${esc(c.duration)} · 📚 ${c.lessons.length} lessons</p>`}
        <div class="actions">${buttons}</div>
      </div>
    </div>`;
}

function renderCourses() {
  const search = $("searchBox").value.trim().toLowerCase();
  const filtered = courses.filter(
    c =>
      (category === "All" || c.category === category) &&
      (c.title.toLowerCase().includes(search) || (c.description || "").toLowerCase().includes(search))
  );
  if (loadError) {
    $("courseList").innerHTML = `<p class="empty">⚠️ Could not load courses from Supabase:<br><code>${esc(loadError)}</code></p>`;
    return;
  }
  $("courseList").innerHTML = filtered.length
    ? filtered.map(c => courseCard(c)).join("")
    : '<p class="empty">No courses found. Try another search.</p>';
}

function renderDashboard() {
  const enrolled = courses.filter(c => isEnrolled(c.id));
  const completed = enrolled.filter(c => percent(c) === 100).length;
  const avg = enrolled.length ? Math.round(enrolled.reduce((sum, c) => sum + percent(c), 0) / enrolled.length) : 0;

  $("welcomeText").textContent = user
    ? `Welcome back, ${user.name}! Here is your progress.`
    : "Please login to track your courses.";
  $("enrolledCount").textContent = enrolled.length;
  $("completedCount").textContent = completed;
  $("avgProgress").textContent = avg + "%";

  if (!user) {
    $("myCourses").innerHTML = "";
  } else if (!enrolled.length) {
    $("myCourses").innerHTML = '<p class="empty">You have not enrolled in any course yet. <a href="#courses">Browse courses →</a></p>';
  } else {
    $("myCourses").innerHTML = enrolled.map(c => courseCard(c, true)).join("");
  }
}

function renderHeader() {
  $("loginBtn").textContent = user ? "Logout" : "Login";
  $("userChip").hidden = !user;
  $("userChip").textContent = user ? "👤 " + user.name : "";
  $("heroSignup").hidden = Boolean(user);
  $("statCourses").textContent = courses.length;
  $("statLessons").textContent = courses.reduce((sum, c) => sum + c.lessons.length, 0);
}

function refresh() {
  renderHeader();
  renderCategories();
  renderCourses();
  renderDashboard();
}

// ---------- User session ----------
async function setUser(u) {
  user = u;
  if (!useSupabase) store.set("cl_user", u);
  try {
    progress = user ? await api.getProgress() : {};
  } catch (err) {
    progress = {};
    toast("Could not load your progress: " + err.message, "error");
  }
  refresh();
}

// ---------- Course actions ----------
async function enroll(id, button) {
  if (!user) {
    toast("Please login or sign up to enroll.");
    openAuth("signup");
    return;
  }
  await busy(button, async () => {
    await api.enroll(id);
    progress[id] = [];
    refresh();
    toast("Enrolled! Happy learning 🎉", "success");
    openCourse(id);
  });
}

async function unenroll(id, button) {
  if (!confirm("Remove this course from your learning? Your progress will be lost.")) return;
  await busy(button, async () => {
    await api.unenroll(id);
    delete progress[id];
    refresh();
    toast("Course removed.");
  });
}

let openCourseId = null;

function openCourse(id) {
  const c = courses.find(x => x.id === id);
  openCourseId = id;
  $("modalTitle").textContent = c.icon + " " + c.title;
  $("modalDesc").textContent = c.description;
  $("modalVideo").src = c.video_url || "";
  renderLessons(c);
  showModal("courseModal");
}

function renderLessons(c) {
  const done = progress[c.id] || [];
  $("lessonList").innerHTML = c.lessons
    .map(
      (lesson, i) => `
      <li class="${done.includes(i) ? "done" : ""}">
        <label>
          <input type="checkbox" data-lesson="${i}" ${done.includes(i) ? "checked" : ""} />
          <span>Lesson ${i + 1}: ${esc(lesson)}</span>
        </label>
      </li>`
    )
    .join("");
  $("modalProgress").style.width = percent(c) + "%";
  $("modalProgressText").textContent = `${done.length}/${c.lessons.length} done · ${percent(c)}%`;
}

async function toggleLesson(index, checkbox) {
  const c = courses.find(x => x.id === openCourseId);
  const before = progress[c.id] || [];
  const after = checkbox.checked ? [...new Set([...before, index])] : before.filter(i => i !== index);

  checkbox.disabled = true;
  try {
    await api.saveLessons(c.id, after);
    progress[c.id] = after;
    renderLessons(c);
    refresh();
    if (percent(c) === 100) toast(`🎓 Congratulations! You completed "${c.title}".`, "success");
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    toast("Could not save: " + err.message, "error");
  } finally {
    checkbox.disabled = false;
  }
}

// ---------- Auth modal ----------
function openAuth(mode) {
  setAuthMode(mode);
  showModal("authModal");
  $("authEmail").focus();
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === mode));
  const signup = mode === "signup";
  $("authName").hidden = !signup;
  $("authName").required = signup;
  $("authConfirm").hidden = !signup;
  $("authConfirm").required = signup;
  $("authHint").hidden = !signup;
  $("authPassword").placeholder = signup ? "Create a new password" : "Your CloudLearn password";
  $("authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("authSubmit").textContent = signup ? "Create Account" : "Login";
}

$("authForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("authName").value.trim();
  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;

  if (authMode === "signup" && password !== $("authConfirm").value) {
    toast("Passwords do not match. Please type the same new password twice.", "error");
    return;
  }

  busy($("authSubmit"), async () => {
    if (authMode === "signup") {
      const loggedIn = await api.signUp(name, email, password);
      if (!loggedIn) {
        toast("Account created! Check your email to confirm, then login.", "success");
        setAuthMode("login");
        return;
      }
      toast(`Welcome to CloudLearn, ${name}! 🎉`, "success");
    } else {
      await api.signIn(email, password);
      toast("Logged in successfully.", "success");
    }
    $("authForm").reset();
    hideModal("authModal");
  });
});

// ---------- Modals ----------
function showModal(id) {
  $(id).classList.add("show");
}

function hideModal(id) {
  $(id).classList.remove("show");
  if (id === "courseModal") {
    $("modalVideo").src = ""; // stop the video
    openCourseId = null;
  }
}

// ---------- Event listeners ----------
document.addEventListener("click", e => {
  const t = e.target;
  if (t.dataset.enroll) enroll(Number(t.dataset.enroll), t);
  else if (t.dataset.unenroll) unenroll(Number(t.dataset.unenroll), t);
  else if (t.dataset.open) openCourse(Number(t.dataset.open));
  else if (t.dataset.cat) {
    category = t.dataset.cat;
    renderCategories();
    renderCourses();
  } else if (t.dataset.tab) setAuthMode(t.dataset.tab);
  else if (t.dataset.close) hideModal(t.dataset.close);
  else if (t.classList.contains("modal")) hideModal(t.id);
});

$("lessonList").addEventListener("change", e => {
  if (e.target.dataset.lesson) toggleLesson(Number(e.target.dataset.lesson), e.target);
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".modal.show").forEach(m => hideModal(m.id));
});

$("searchBox").addEventListener("input", renderCourses);

$("loginBtn").addEventListener("click", async () => {
  if (user) {
    await api.signOut();
    toast("Logged out.");
  } else {
    openAuth("login");
  }
});

$("heroSignup").addEventListener("click", () => openAuth("signup"));

$("menuBtn").addEventListener("click", () => $("navLinks").classList.toggle("open"));
$("navLinks").addEventListener("click", () => $("navLinks").classList.remove("open"));

// Dark mode
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("themeBtn").textContent = theme === "dark" ? "☀️" : "🌙";
}
$("themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  store.set("cl_theme", next);
});
applyTheme(store.get("cl_theme", matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));

// ---------- Start the app ----------
async function init() {
  $("courseList").innerHTML = '<div class="card skeleton"></div>'.repeat(3);
  $("demoBanner").hidden = useSupabase;

  try {
    courses = await api.getCourses();
  } catch (err) {
    courses = [];
    loadError = err.message;
  }

  if (useSupabase) {
    // Fires on page load (existing session), login and logout.
    // setTimeout avoids calling Supabase from inside its own callback.
    sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      setTimeout(() =>
        setUser(u ? { id: u.id, email: u.email, name: u.user_metadata?.full_name || u.email.split("@")[0] } : null)
      );
    });
  } else {
    await setUser(store.get("cl_user", null));
  }
  refresh();
}

init();
