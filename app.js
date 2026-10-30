(() => {
  const $ = (id) => document.getElementById(id);
  const categories = ["All topics", ...new Set(QUESTION_BANK.map((q) => q.category))];
  let activeCategory = "All topics";
  let visibleQuestions = QUESTION_BANK;
  let index = 0;
  let selected = null;
  let checked = false;
  let score = 0;
  let menuOpen = false;

  const topicTrigger = $("topicTrigger");
  const topicMenu = $("topicMenu");
  const topicOptions = $("topicOptions");
  const actionButton = $("actionButton");

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("drive-theme", theme);
    $("themeToggle").setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} theme`);
    document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0b0a14" : "#f5f2fb";
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
    $("questionIndex").textContent = String(index + 1).padStart(2, "0");
    $("questionTotal").textContent = String(visibleQuestions.length).padStart(2, "0");
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
      button.innerHTML = `<span class="answer-letter">${String.fromCharCode(65 + answerIndex)}</span><span class="answer-text" lang="hu"></span><span class="answer-check" aria-hidden="true">✓</span>`;
      button.querySelector(".answer-text").textContent = answer;
      button.addEventListener("click", () => { if (checked) return; selected = answerIndex; [...answers.children].forEach((el, i) => { el.classList.toggle("selected", i === selected); el.setAttribute("aria-checked", String(i === selected)); }); actionButton.disabled = false; });
      answers.append(button);
    });
    $("feedback").hidden = true; $("feedback").classList.remove("incorrect");
    $("sourceLink").hidden = true;
    $("actionLabel").textContent = "Check answer"; actionButton.disabled = true;
  }

  function checkAnswer() {
    const question = visibleQuestions[index]; checked = true;
    const correct = selected === question.correct;
    if (correct) { score += 1; $("scoreCount").textContent = String(score); }
    [...$("answers").children].forEach((el, i) => { el.disabled = true; if (i === question.correct) el.classList.add("correct"); else if (i === selected) el.classList.add("incorrect"); });
    const feedback = $("feedback"); feedback.hidden = false; feedback.classList.toggle("incorrect", !correct);
    $("feedbackIcon").textContent = correct ? "✓" : "!";
    $("feedbackTitle").textContent = correct ? "Correct" : "Not quite";
    $("feedbackText").textContent = question.explanation;
    if (question.source) { $("sourceLink").href = question.source; $("sourceLink").hidden = false; }
    $("actionLabel").textContent = index === visibleQuestions.length - 1 ? "Start again" : "Next question";
    actionButton.disabled = false;
  }
  function advance() {
    if (!checked) { checkAnswer(); return; }
    if (index === visibleQuestions.length - 1) { index = 0; score = 0; $("scoreCount").textContent = "0"; }
    else index += 1;
    renderQuestion();
  }
  actionButton.addEventListener("click", advance);
  renderTopicOptions(); renderQuestion();
})();
