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
let user = null; // { id, name, username }
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
    instructor: "Simplilearn", requirements: "No experience needed.",
    about: "A beginner-friendly introduction to cloud computing. Understand what the cloud is, why companies use it, and how the main service and deployment models work.",
    outcomes: ["Explain what cloud computing is", "Compare IaaS, PaaS and SaaS with examples", "Describe public, private and hybrid clouds", "List the main benefits and risks of the cloud"],
    lessons: ["What is Cloud Computing?", "Service Models (IaaS, PaaS, SaaS)", "Deployment Models", "Benefits and Challenges"] },
  { id: 2, title: "AWS for Beginners", category: "Cloud", level: "Beginner", icon: "🟧", duration: "6 hours",
    description: "Get started with Amazon Web Services: EC2, S3 and more.", video_url: "https://www.youtube.com/embed/3hLmDS179YE",
    instructor: "freeCodeCamp.org", requirements: "Basic computer skills. Introduction to Cloud Computing is recommended first.",
    about: "Learn the core Amazon Web Services used in the real world, and prepare for the AWS Certified Cloud Practitioner exam.",
    outcomes: ["Create and secure an AWS account", "Launch virtual servers with EC2", "Store and share files with S3", "Manage users and permissions with IAM"],
    lessons: ["AWS Account Setup", "EC2 Virtual Machines", "S3 Storage", "IAM Users and Roles", "Hosting a Website"] },
  { id: 3, title: "Python Programming", category: "Programming", level: "Beginner", icon: "🐍", duration: "8 hours",
    description: "Master Python from basics to functions and file handling.", video_url: "https://www.youtube.com/embed/_uQrJ0TkZlc",
    instructor: "Programming with Mosh", requirements: "No programming experience needed.",
    about: "Learn Python from scratch. It is one of the most popular programming languages, used for web apps, automation, data science and cloud scripting.",
    outcomes: ["Write and run Python programs", "Use variables, conditions and loops", "Create reusable functions", "Work with lists, dictionaries and files"],
    lessons: ["Variables and Data Types", "Conditions and Loops", "Functions", "Lists and Dictionaries", "File Handling"] },
  { id: 4, title: "HTML & CSS Basics", category: "Web", level: "Beginner", icon: "🌐", duration: "5 hours",
    description: "Build beautiful web pages with HTML and CSS.", video_url: "https://www.youtube.com/embed/mU6anWqZJcc",
    instructor: "freeCodeCamp.org", requirements: "No experience needed.",
    about: "Build your first web pages. HTML gives a page its structure and CSS makes it look good; together they are the starting point of all web development.",
    outcomes: ["Structure web pages with HTML5", "Add text, links and images", "Style pages with CSS selectors", "Build layouts with Flexbox and Grid"],
    lessons: ["HTML Structure", "Text, Links and Images", "CSS Selectors", "Flexbox and Grid"] },
  { id: 5, title: "JavaScript Essentials", category: "Web", level: "Intermediate", icon: "⚡", duration: "6 hours",
    description: "Add interactivity to websites using JavaScript.", video_url: "https://www.youtube.com/embed/W6NZfCO5SIk",
    instructor: "Programming with Mosh", requirements: "Basic HTML & CSS.",
    about: "Make websites interactive with JavaScript, the programming language of the web.",
    outcomes: ["Use variables, functions and objects", "Change web pages with the DOM", "Respond to clicks and other events", "Fetch data from online APIs"],
    lessons: ["Variables and Functions", "DOM Manipulation", "Events", "Fetching Data from APIs"] },
  { id: 6, title: "SQL & Databases", category: "Database", level: "Intermediate", icon: "🗄️", duration: "5 hours",
    description: "Understand relational databases and write SQL queries.", video_url: "https://www.youtube.com/embed/HXV3zeQKqGY",
    instructor: "freeCodeCamp.org", requirements: "No experience needed.",
    about: "Understand how relational databases store data, and write SQL queries to read and change it, the same skills used with cloud databases like Supabase.",
    outcomes: ["Understand tables, rows and keys", "Query data with SELECT", "Insert, update and delete records", "Combine tables with joins"],
    lessons: ["What is a Database?", "SELECT Queries", "INSERT, UPDATE, DELETE", "Joins", "Cloud Databases (Supabase / Postgres)"] },
];

// ---------- Usernames ----------
// Supabase Auth needs an email-style login, so each username is turned into
// a hidden internal address. No email is ever sent to it
// ("Confirm email" must be OFF in Supabase).
const USERNAME_DOMAIN = "cloudlearn.app";
const usernameToEmail = username => `${username}@${USERNAME_DOMAIN}`;
// "Avi Jambhale" → "avi_jambhale" (same result at sign up and login)
const cleanUsername = text => text.trim().toLowerCase().replace(/\s+/g, "_");

// Returns an error message, or "" if the username is fine
function usernameProblem(username) {
  if (!username) return "Please enter a username.";
  if (username.includes("@")) return "Please enter your username, not an email address.";
  if (username.length < 3) return "Username is too short. Use at least 3 characters.";
  if (username.length > 20) return "Username is too long. Use 20 characters or fewer.";
  if (!/^[a-z0-9_.-]+$/.test(username)) return "Username can only use letters, numbers, _ . or -";
  if (/^[.-]|[.-]$|\.\./.test(username)) return "Username can't start or end with . or -, or have .. in it.";
  return "";
}

// Strong password rules for sign up; returns the list of what's missing
function passwordProblems(password) {
  const rules = [
    [password.length >= 8, "at least 8 characters"],
    [/[A-Z]/.test(password), "an uppercase letter"],
    [/[a-z]/.test(password), "a lowercase letter"],
    [/[0-9]/.test(password), "a number"],
    [/[^A-Za-z0-9]/.test(password), "a symbol (like @ # ! $)"],
  ];
  return rules.filter(([ok]) => !ok).map(([, label]) => label);
}

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
  async signUp(name, username, password) {
    const data = check(
      await sb.auth.signUp({
        email: usernameToEmail(username),
        password,
        options: { data: { full_name: name, username } },
      })
    );
    return Boolean(data.session); // false = "Confirm email" is still ON in Supabase
  },
  async signIn(username, password) {
    check(await sb.auth.signInWithPassword({ email: usernameToEmail(username), password }));
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
    return store.get("cl_progress_" + user.id, {});
  },
  async enroll(courseId) {
    progress[courseId] = [];
    store.set("cl_progress_" + user.id, progress);
  },
  async unenroll(courseId) {
    delete progress[courseId];
    store.set("cl_progress_" + user.id, progress);
  },
  async saveLessons(courseId, lessons) {
    progress[courseId] = lessons;
    store.set("cl_progress_" + user.id, progress);
  },
  async signUp(name, username, password) {
    const users = store.get("cl_users", {});
    if (users[username]) throw new Error("User already registered");
    users[username] = { name, password }; // demo only: never store passwords like this in a real app
    store.set("cl_users", users);
    await setUser({ id: username, name, username });
    return true;
  },
  async signIn(username, password) {
    const account = store.get("cl_users", {})[username];
    if (!account || account.password !== password) throw new Error("Invalid login credentials");
    await setUser({ id: username, name: account.name, username });
  },
  async signOut() {
    await setUser(null);
  },
};

const api = useSupabase ? supabaseApi : demoApi;

// Fill in course details from the built-in list when the database doesn't have them
// (for example if supabase/update_course_details.sql hasn't been run yet)
function withDetails(course) {
  const extra = DEMO_COURSES.find(d => d.title === course.title);
  if (!extra) return course;
  const oldDatabase = !course.instructor; // old rows also have the blocked HTML & CSS video
  return {
    ...course,
    instructor: course.instructor || extra.instructor,
    about: course.about || extra.about,
    outcomes: course.outcomes?.length ? course.outcomes : extra.outcomes,
    requirements: course.requirements || extra.requirements,
    video_url: oldDatabase ? extra.video_url : course.video_url,
  };
}

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
    if (/invalid login credentials/i.test(message)) {
      message = "Wrong username or password.";
    } else if (/already registered|already exists/i.test(message)) {
      message = "This username is already taken. Please choose another one.";
    } else if (/rate limit/i.test(message)) {
      message = "Too many sign ups right now. Please wait a few minutes and try again.";
    } else if (/email not confirmed/i.test(message)) {
      message = "This account isn't activated yet. Ask the admin to turn off 'Confirm email' in Supabase.";
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
    buttons = `
      <button class="btn" data-enroll="${c.id}">Enroll Free</button>
      <button class="btn btn-ghost" data-open="${c.id}">Details</button>`;
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
    hideModal("courseModal"); // so the login box isn't hidden behind it
    openAuth("signup");
    return;
  }
  await busy(button, async () => {
    await api.enroll(id);
    progress[id] = [];
    refresh();
    toast("Enrolled! Happy learning 🎉", "success");
    // Already looking at this course's details? Just unlock the lessons (keeps the video playing)
    if (openCourseId === id) renderLessons(courses.find(x => x.id === id));
    else openCourse(id);
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
  stopVideo();
  openCourseId = id;
  $("modalTitle").textContent = c.icon + " " + c.title;
  $("modalDesc").textContent = c.description;
  renderDetails(c);
  renderLessons(c);
  showModal("courseModal");
  playVideo(c);
}

function renderDetails(c) {
  const meta = [
    c.category && "📂 " + c.category,
    c.level && "📊 " + c.level,
    c.duration && "⏱ " + c.duration,
    `📚 ${c.lessons.length} lessons`,
    c.instructor && "🎓 " + c.instructor,
  ].filter(Boolean);
  $("modalMeta").innerHTML = meta.map(m => `<span>${esc(m)}</span>`).join("");

  $("modalAbout").innerHTML = c.about ? `<h3>About this course</h3><p>${esc(c.about)}</p>` : "";
  $("modalOutcomes").innerHTML = c.outcomes?.length
    ? `<h3>What you'll learn</h3><ul class="outcomes">${c.outcomes.map(o => `<li>${esc(o)}</li>`).join("")}</ul>`
    : "";
  $("modalRequirements").innerHTML = c.requirements ? `<h3>Requirements</h3><p>${esc(c.requirements)}</p>` : "";
}

// ---------- Video player ----------
// Uses the YouTube IFrame API to track which seconds of the video were really watched.
// The video is split into equal parts, one per lesson. A lesson completes automatically
// once 90% of its part has been watched; skipping ahead doesn't count.
let player = null;
let youtubeApi = null;
let watch = null; // { courseId, seen: Set of watched seconds, timer, saving }

const WATCH_REQUIRED = 0.9; // share of each lesson's part that must be watched

function loadYouTubeApi() {
  youtubeApi ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve();
    window.onYouTubeIframeAPIReady = resolve;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return youtubeApi;
}

function youtubeId(url) {
  const match = (url || "").match(/(?:embed\/|watch\?v=|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

async function playVideo(c) {
  const videoId = youtubeId(c.video_url);
  if (!videoId) return;
  $("videoBox").innerHTML = '<div id="ytPlayer"></div>';
  try {
    await loadYouTubeApi();
  } catch {
    // YouTube API blocked: show a plain video (progress can't be tracked)
    $("videoBox").innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
    return;
  }
  if (openCourseId !== c.id) return; // course was closed while loading

  watch = { courseId: c.id, seen: new Set(), saving: false };
  // Check twice a second, so even 2x playback speed doesn't miss any seconds
  watch.timer = setInterval(() => recordWatching(c), 500);

  player = new YT.Player("ytPlayer", {
    videoId,
    playerVars: { rel: 0 },
    events: {
      onStateChange: e => {
        if (e.data === YT.PlayerState.ENDED) videoEnded(c);
      },
    },
  });
}

function stopVideo() {
  if (watch) clearInterval(watch.timer);
  watch = null;
  try {
    player?.destroy();
  } catch {}
  player = null;
  $("videoBox").innerHTML = "";
}

function recordWatching(c) {
  if (!watch || !player?.getPlayerState) return;
  if (player.getPlayerState() !== YT.PlayerState.PLAYING) return;
  watch.seen.add(Math.floor(player.getCurrentTime()));
  updateLessonsFromWatching(c);
}

// Which lessons have now been watched enough (that weren't already complete)
function newlyWatchedLessons(c) {
  const duration = Math.floor(player?.getDuration?.() || 0);
  if (!duration || !watch) return [];
  const done = progress[c.id] || [];
  const part = duration / c.lessons.length;
  const result = [];
  c.lessons.forEach((_, i) => {
    if (done.includes(i)) return;
    const from = Math.floor(i * part);
    const to = Math.floor((i + 1) * part);
    let watched = 0;
    for (let t = from; t < to; t++) if (watch.seen.has(t)) watched++;
    if (watched >= WATCH_REQUIRED * (to - from)) result.push(i);
  });
  return result;
}

async function updateLessonsFromWatching(c) {
  if (!user || !isEnrolled(c.id) || watch.saving) return;
  const newly = newlyWatchedLessons(c);
  if (!newly.length) return;

  const lessons = [...new Set([...(progress[c.id] || []), ...newly])].sort((a, b) => a - b);
  watch.saving = true;
  try {
    await api.saveLessons(c.id, lessons);
    progress[c.id] = lessons;
    if (openCourseId === c.id) renderLessons(c);
    refresh();
    if (percent(c) === 100) {
      toast(`🎓 Congratulations! You completed "${c.title}".`, "success");
    } else {
      toast(`✅ Lesson ${newly.map(i => i + 1).join(", ")} complete!`, "success");
    }
  } catch (err) {
    toast("Could not save your progress: " + err.message, "error");
  } finally {
    if (watch) watch.saving = false;
  }
}

function videoEnded(c) {
  if (!user || !isEnrolled(c.id)) return;
  // Give the last save a moment, then explain if parts were skipped
  setTimeout(() => {
    if (percent(c) < 100) {
      toast("Some parts were skipped. Watch the full video to complete every lesson.", "error");
    }
  }, 1500);
}

function renderLessons(c) {
  const enrolled = isEnrolled(c.id);
  const done = progress[c.id] || [];

  // Not enrolled yet: show an Enroll button
  $("modalEnroll").innerHTML = enrolled
    ? ""
    : `<button class="btn" data-enroll="${c.id}">Enroll Free to Track Progress</button>`;

  // Lessons can't be ticked by hand; they complete by watching the video
  $("lessonList").innerHTML = c.lessons
    .map(
      (lesson, i) => `
      <li class="${done.includes(i) ? "done" : ""}">
        <span class="lesson-status">${done.includes(i) ? "✅" : "⬜"}</span>
        <span>Lesson ${i + 1}: ${esc(lesson)}</span>
      </li>`
    )
    .join("");
  $("modalProgress").style.width = percent(c) + "%";
  $("modalProgressText").textContent = enrolled
    ? `${done.length}/${c.lessons.length} done · ${percent(c)}%`
    : "Enroll to track your progress";
}

// ---------- Auth modal ----------
function openAuth(mode) {
  setAuthMode(mode);
  showModal("authModal");
  $(mode === "signup" ? "authName" : "authUsername").focus();
}

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === mode));
  const signup = mode === "signup";
  $("authName").hidden = !signup;
  $("authUsername").placeholder = signup ? "Choose a username" : "Username";
  $("authName").required = signup;
  $("authConfirm").hidden = !signup;
  $("authConfirm").required = signup;
  $("authPassword").placeholder = signup ? "Create a strong password" : "Your CloudLearn password";
  $("authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("authSubmit").textContent = signup ? "Create Account" : "Login";
}

$("authForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("authName").value.trim();
  const username = cleanUsername($("authUsername").value);
  const password = $("authPassword").value;

  const problem = usernameProblem(username);
  if (problem) {
    toast(problem, "error");
    return;
  }
  if (authMode === "signup") {
    const missing = passwordProblems(password);
    if (missing.length) {
      toast("Weak password. It needs " + missing.join(", ") + ".", "error");
      return;
    }
    if (password !== $("authConfirm").value) {
      toast("Passwords do not match. Please type the same new password twice.", "error");
      return;
    }
  }

  busy($("authSubmit"), async () => {
    if (authMode === "signup") {
      const loggedIn = await api.signUp(name, username, password);
      if (!loggedIn) {
        toast("Account created, but it can't be used until 'Confirm email' is turned off in Supabase.", "error");
        setAuthMode("login");
        return;
      }
      toast(`Welcome to CloudLearn, ${name}! 🎉`, "success");
    } else {
      await api.signIn(username, password);
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
    stopVideo();
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
function toUser(u) {
  const username = u.user_metadata?.username || u.email.split("@")[0];
  return { id: u.id, username, name: u.user_metadata?.full_name || username };
}

async function init() {
  $("courseList").innerHTML = '<div class="card skeleton"></div>'.repeat(3);
  $("demoBanner").hidden = useSupabase;

  try {
    courses = (await api.getCourses()).map(withDetails);
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
        setUser(u ? toUser(u) : null)
      );
    });
  } else {
    await setUser(store.get("cl_user", null));
  }
  refresh();
}

init();
