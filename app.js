(() => {
  const $ = (id) => document.getElementById(id);
  let QUESTION_BANK = [];
  let categories = ["All topics"];
  let activeCategory = "All topics";
  let visibleQuestions = QUESTION_BANK;
  let index = 0;
  let selected = null;
  let checked = false;
  let score = 0;
  let menuOpen = false;
  let quizSessionId = sessionStorage.getItem("drive-quiz-session") || crypto.randomUUID();
  sessionStorage.setItem("drive-quiz-session", quizSessionId);
  const quizApiUrl = window.QUIZ_API_URL || "";
  const apiBase = quizApiUrl.replace(/\/$/u, "");
  let authToken = sessionStorage.getItem("drive-auth-token") || "";
  let authMode = "login";

  const authDialog = $("authDialog");
  const authForm = $("authForm");
  const authSwitch = $("authSwitch");
  const authClose = $("authClose");
  const authStatus = $("authStatus");
  const inviteField = $("inviteField");
  const authSubmit = $("authSubmit");
  const logoutButton = $("logoutButton");
  const loginButton = $("loginButton");
  const guestCard = $("guestCard");
  const practicePanel = $("practicePanel");

  function showAuth(status = "") {
    authStatus.textContent = status;
    if (!authDialog.open) authDialog.showModal();
  }

  function showSignedOut() {
    guestCard.hidden = false;
    practicePanel.hidden = true;
    $("pageNote").hidden = true;
    $("railProgress").hidden = true;
    logoutButton.hidden = true;
  }

  function clearQuiz() {
    QUESTION_BANK = [];
    visibleQuestions = [];
    categories = ["All topics"];
    index = 0;
    score = 0;
    selected = null;
    checked = false;
    $("scoreCount").textContent = "0";
    $("questionCategory").textContent = "";
    $("questionText").textContent = "";
    $("questionIllustration").removeAttribute("src");
    $("questionIllustration").hidden = true;
    $("answers").replaceChildren();
    $("feedback").hidden = true;
    $("successBurst").hidden = true;
    $("topicOptions").replaceChildren();
  }

  loginButton.addEventListener("click", () => showAuth());
  authClose.addEventListener("click", () => authDialog.close());

  function setAuthMode(mode) {
    authMode = mode;
    const registering = mode === "register";
    $("authTitle").textContent = registering ? "Create your account" : "Welcome back";
    $("authDescription").textContent = registering ? "Enter your invite code to create an account." : "Sign in to continue your Hungarian theory practice.";
    $("authPassword").autocomplete = registering ? "new-password" : "current-password";
    $("authPassword").minLength = 12;
    inviteField.hidden = !registering;
    $("authInvite").required = registering;
    authSubmit.textContent = registering ? "Create account" : "Sign in";
    authSwitch.textContent = registering ? "Already have an account? Sign in" : "Need an account? Create one";
    authStatus.textContent = "";
  }

  authSwitch.addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));
  authDialog.addEventListener("cancel", (event) => { if (!authToken) event.preventDefault(); });
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!apiBase) { showAuth("Sign in is not connected yet."); return; }
    authSubmit.disabled = true;
    authStatus.textContent = "Connecting…";
    const form = new FormData(authForm);
    const payload = {
      username: form.get("username"),
      password: form.get("password")
    };
    if (authMode === "register") payload.inviteCode = form.get("inviteCode");
    try {
      const response = await fetch(`${apiBase}/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      authToken = result.token;
      sessionStorage.setItem("drive-auth-token", authToken);
      logoutButton.hidden = false;
      authDialog.close();
      authForm.reset();
      setAuthMode("login");
      const loaded = await loadQuiz();
      if (!loaded) {
        authStatus.textContent = "Your account was verified, but the quiz could not load. Please try again.";
        showSignedOut();
      }
    } catch (error) {
      authStatus.textContent = error.message || "Could not reach the sign-in service.";
    } finally {
      authSubmit.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      if (authToken && apiBase) await fetch(`${apiBase}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${authToken}` } });
    } finally {
      authToken = "";
      sessionStorage.removeItem("drive-auth-token");
      clearQuiz();
      showSignedOut();
      authDialog.close();
    }
  });

  showSignedOut();
  if (authToken) logoutButton.hidden = false;

  function startNewQuizSession() {
    quizSessionId = crypto.randomUUID();
    sessionStorage.setItem("drive-quiz-session", quizSessionId);
  }

  const topicTrigger = $("topicTrigger");
  const topicMenu = $("topicMenu");
  const topicOptions = $("topicOptions");
  const actionButton = $("actionButton");

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("drive-theme", theme);
    $("themeToggle").setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#000000" : "#f5f2fb";
  }
  setTheme(localStorage.getItem("drive-theme") || "dark");
  $("themeToggle").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));

  function questionCount(category) { return category === "All topics" ? QUESTION_BANK.length : QUESTION_BANK.filter(q => q.category === category).length; }
  function renderTopicOptions() {
    topicOptions.innerHTML = "";
    categories.forEach((category) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = `topic-option${category === activeCategory ? " active" : ""}`;
      option.innerHTML = `<span>${category}</span><span class="topic-count">${questionCount(category)}</span>`;
      option.addEventListener("click", () => {
        startNewQuizSession();
        activeCategory = category;
        visibleQuestions = category === "All topics" ? QUESTION_BANK : QUESTION_BANK.filter(q => q.category === category);
        index = 0; score = 0; selected = null; checked = false;
        $("scoreCount").textContent = "0";
        $("topicName").textContent = category;
        closeMenu(); renderTopicOptions(); renderQuestion();
      });
      topicOptions.append(option);
    });
  }
  function openMenu() { menuOpen = true; topicTrigger.setAttribute("aria-expanded", "true"); topicMenu.dataset.open = "true"; topicMenu.setAttribute("aria-hidden", "false"); }
  function closeMenu() { menuOpen = false; topicTrigger.setAttribute("aria-expanded", "false"); topicMenu.dataset.open = "false"; topicMenu.setAttribute("aria-hidden", "true"); }
  topicTrigger.addEventListener("click", () => menuOpen ? closeMenu() : openMenu());
  document.addEventListener("click", (event) => { if (!event.target.closest(".topic-control")) closeMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

  function renderQuestion() {
    const question = visibleQuestions[index];
    if (!question) return;
    selected = null; checked = false;
    $("railQuestionIndex").textContent = String(index + 1).padStart(2, "0");
    $("railQuestionTotal").textContent = String(visibleQuestions.length).padStart(2, "0");
    $("railProgress").setAttribute("aria-label", `Question ${index + 1} of ${visibleQuestions.length}`);
    $("progressFill").style.width = `${((index + 1) / visibleQuestions.length) * 100}%`;
    $("questionCategory").textContent = question.category;
    $("questionText").textContent = question.question;
    const illustration = $("questionIllustration");
    illustration.hidden = !question.illustration;
    if (question.illustration) { illustration.src = question.illustration; illustration.alt = question.illustrationAlt || ""; }
    const answers = $("answers"); answers.innerHTML = "";
    question.options.forEach((answer, answerIndex) => {
      const button = document.createElement("button");
      button.type = "button"; button.className = "answer-option"; button.setAttribute("role", "radio"); button.setAttribute("aria-checked", "false");
      button.innerHTML = `<span class="answer-letter">${String.fromCharCode(65 + answerIndex)}</span><span class="answer-text" lang="hu"></span><span class="answer-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>`;
      button.querySelector(".answer-text").textContent = answer;
      button.addEventListener("click", () => { if (checked) return; selected = answerIndex; [...answers.children].forEach((el, i) => { el.classList.toggle("selected", i === selected); el.setAttribute("aria-checked", String(i === selected)); }); actionButton.disabled = false; });
      answers.append(button);
    });
    $("feedback").hidden = true; $("feedback").classList.remove("incorrect");
    $("successBurst").hidden = true;
    $("sourceLink").hidden = true;
    $("actionLabel").textContent = "Check answer"; actionButton.disabled = true;
  }

  function checkAnswer() {
    const question = visibleQuestions[index]; checked = true;
    if (!quizApiUrl) {
      const feedback = $("feedback"); feedback.hidden = false; feedback.classList.add("incorrect");
      $("successBurst").hidden = true;
      $("feedbackIcon").textContent = "!"; $("feedbackTitle").textContent = "Checker unavailable";
      $("feedbackText").textContent = "The answer checker is not connected yet.";
      return;
    }
    actionButton.disabled = true;
    [...$("answers").children].forEach((el) => { el.disabled = true; });
    fetch(`${apiBase}/api/attempt`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ questionId: question.id, sessionId: quizSessionId })
    }).then(async (response) => {
      const attempt = await response.json();
      if (!response.ok) { const error = new Error("Attempt unavailable"); error.status = response.status; throw error; }
      return attempt;
    }).then(({ attemptToken }) => fetch(`${apiBase}/api/check`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ questionId: question.id, selectedIndex: selected, attemptToken, sessionId: quizSessionId })
    })).then(async (response) => {
      const result = await response.json();
      if (!response.ok) { const error = new Error("Answer check unavailable"); error.status = response.status; throw error; }
      return result;
    }).then((result) => {
      const correct = result.correct === true;
      if (correct) { score += 1; $("scoreCount").textContent = String(score); }
      [...$("answers").children].forEach((el, i) => { el.disabled = true; if (i === selected) el.classList.add(correct ? "correct" : "incorrect"); });
      const feedback = $("feedback"); feedback.hidden = false; feedback.classList.toggle("incorrect", !correct);
      $("successBurst").hidden = !correct;
      if (!correct) $("answers").children[selected].querySelector(".answer-check").innerHTML = "×";
      $("feedbackIcon").textContent = correct ? "✓" : "!";
      $("feedbackTitle").textContent = correct ? "Correct" : "Not quite";
      $("feedbackText").textContent = "Keep practicing the Hungarian road rules.";
      $("sourceLink").hidden = true;
      $("actionLabel").textContent = index === visibleQuestions.length - 1 ? "Start again" : "Next question";
      actionButton.disabled = false;
    }).catch((error) => {
      if (error.status === 401) {
        authToken = "";
        sessionStorage.removeItem("drive-auth-token");
        clearQuiz();
        showSignedOut();
        guestCard.querySelector(".guest-footnote").textContent = "Your session ended. Sign in to continue.";
        return;
      }
      if (error.status === 409) {
        checked = true;
        [...$("answers").children].forEach((el) => { el.disabled = true; });
        const feedback = $("feedback"); feedback.hidden = false; feedback.classList.add("incorrect");
        $("successBurst").hidden = true;
        $("feedbackIcon").textContent = "!"; $("feedbackTitle").textContent = "Attempt already used";
        $("feedbackText").textContent = "This question was already checked in this quiz run. Start a new quiz run to try it again.";
        $("actionLabel").textContent = index === visibleQuestions.length - 1 ? "Start again" : "Next question";
        actionButton.disabled = false;
        return;
      }
      checked = false;
      const feedback = $("feedback"); feedback.hidden = false; feedback.classList.add("incorrect");
      $("successBurst").hidden = true;
      $("feedbackIcon").textContent = "!"; $("feedbackTitle").textContent = "Could not check answer";
      $("feedbackText").textContent = error.status === 429 ? "Too many requests. Please wait a minute and try again." : "Please try again in a moment.";
      [...$("answers").children].forEach((el) => { el.disabled = false; });
      $("actionLabel").textContent = "Check answer";
      actionButton.disabled = false;
    });
  }
  function advance() {
    if (!checked) { checkAnswer(); return; }
    if (index === visibleQuestions.length - 1) { startNewQuizSession(); index = 0; score = 0; $("scoreCount").textContent = "0"; }
    else index += 1;
    renderQuestion();
  }
  actionButton.addEventListener("click", advance);
  async function loadQuiz() {
    if (!authToken || !apiBase) return false;
    try {
      const response = await fetch(`${apiBase}/api/questions`, { headers: { Accept: "application/json", Authorization: `Bearer ${authToken}` } });
      if (response.status === 401) {
        authToken = "";
        sessionStorage.removeItem("drive-auth-token");
        clearQuiz();
        showSignedOut();
        guestCard.querySelector(".guest-footnote").textContent = "Your session ended. Sign in to continue.";
        return false;
      }
      if (!response.ok) throw new Error("Question request failed");
      const result = await response.json();
      if (!Array.isArray(result.questions) || !result.questions.length) throw new Error("Invalid question bank");
      QUESTION_BANK = result.questions;
      categories = ["All topics", ...new Set(QUESTION_BANK.map((question) => question.category))];
      visibleQuestions = QUESTION_BANK;
      renderTopicOptions();
      renderQuestion();
      guestCard.hidden = true;
      practicePanel.hidden = false;
      $("pageNote").hidden = false;
      $("railProgress").hidden = false;
      logoutButton.hidden = false;
      return true;
    } catch {
      clearQuiz();
      showSignedOut();
      guestCard.querySelector(".guest-footnote").textContent = "The quiz is unavailable right now. Please try signing in again shortly.";
      return false;
    }
  }
  loadQuiz();
})();
