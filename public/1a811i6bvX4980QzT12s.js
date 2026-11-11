(function () {

  const widget = document.getElementById("jupiter-ai-widget");

  if (!widget || widget.dataset.initialized) return;

  widget.dataset.initialized = "true";


  const toggle = document.getElementById("jupiter-ai-toggle");

  const close = document.getElementById("jupiter-ai-close");

  const windowBox = document.getElementById("jupiter-ai-window");

  const input = document.getElementById("jupiter-ai-input");

  const send = document.getElementById("jupiter-ai-send");

  const status = document.getElementById("jupiter-ai-status");

  const messages = document.getElementById("jupiter-ai-messages");


  /* ------------------------------------------
     OPEN ASSISTANT
  ------------------------------------------ */

  function openAssistant() {

    windowBox.classList.add("ai-open");

    windowBox.setAttribute("aria-hidden", "false");

    toggle.setAttribute("aria-expanded", "true");

    input.focus();

  }


  /* ------------------------------------------
     CLOSE ASSISTANT
  ------------------------------------------ */

  function closeAssistant() {

    windowBox.classList.remove("ai-open");

    windowBox.setAttribute("aria-hidden", "true");

    toggle.setAttribute("aria-expanded", "false");

  }


  toggle.addEventListener("click", function () {

    if (windowBox.classList.contains("ai-open")) {

      closeAssistant();

    } else {

      openAssistant();

    }

  });


  close.addEventListener("click", closeAssistant);


  document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

      closeAssistant();

    }

  });


  /* ------------------------------------------
     ADD CHAT MESSAGE
  ------------------------------------------ */

function addMessage(text, type) {

  const message = document.createElement("div");

  message.className = "jupiter-ai-message " + type;

  if (type === "ai") {
    message.innerHTML = DOMPurify.sanitize(
      marked.parse(text)
    );
  } else {
    message.textContent = text;
  }

  messages.appendChild(message);

  messages.scrollTop = messages.scrollHeight;

  return message;
}


/* ------------------------------------------
   SEND QUESTION TO GEMINI
------------------------------------------ */

let unknownQuestionCount = 0;
	
async function askGemini() {

  const question = input.value.trim();

  if (!question || send.disabled) return;

  // Add user's message
  addMessage(question, "user");

  input.value = "";

  // Loading state
  send.disabled = true;

  status.textContent = "Gemini is thinking...";

  const thinking = addMessage("", "ai");

thinking.classList.add("ai-typing");

thinking.innerHTML = `
  <span class="ai-typing-dots">
    <span></span>
    <span></span>
    <span></span>
  </span>
`;

  try {

    const response = await fetch("/api/gemini", {

      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
  message: question,
  unknownCount: unknownQuestionCount
})

    });

    const responseText = await response.text();

    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {

      console.error("Invalid API response:", responseText);

      throw new Error(
        `Server returned invalid JSON (HTTP ${response.status}).`
      );

    }

    if (!response.ok || !data.success) {

      throw new Error(
        data.error ||
        `Gemini API failed (HTTP ${response.status})`
      );

    }

    if (!data.answer) {
      throw new Error("Gemini returned an empty answer.");
    }

    // Display Gemini response
    thinking.innerHTML = DOMPurify.sanitize(
      marked.parse(data.answer)
    );

    status.textContent = "Response received";

  } catch (error) {

    console.error("Jupiter AI Error:", error);

    thinking.textContent =
      "Unable to get a response: " + error.message;

    status.textContent = "Request failed";

  } finally {

    send.disabled = false;

    messages.scrollTop = messages.scrollHeight;

    input.focus();

  }

}

  /* ------------------------------------------
     BUTTON CLICK
  ------------------------------------------ */
  send.addEventListener("click", askGemini);
  /* ------------------------------------------
     ENTER TO SEND
     SHIFT + ENTER FOR NEW LINE
  ------------------------------------------ */
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askGemini();
    }
  });
})();
