const API_URL = "https://bodaleoale-backend.onrender.com/api";

const $ = (selector) => document.querySelector(selector);

const loadingState = $("#loadingState");
const errorState = $("#errorState");
const errorMessage = $("#errorMessage");
const alreadyAnswered = $("#alreadyAnswered");
const answeredMessage = $("#answeredMessage");
const rsvpForm = $("#rsvpForm");
const successState = $("#successState");
const familyName = $("#familyName");
const invitationCode = document.getElementById("invitationCode");
const guestSection = $("#guestSection");
const guestList = $("#guestList");
const selectedCount = $("#selectedCount");
const maxGuests = $("#maxGuests");
const attendanceError = $("#attendanceError");
const guestError = $("#guestError");
const submitButton = $("#submitButton");
const successTitle = $("#successTitle");
const successMessage = $("#successMessage");

let invitation = null;

function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryCode = params.get("codigo") || params.get("code");

  if (queryCode) {
    return queryCode.trim();
  }

  const segments = window.location.pathname.split("/").filter(Boolean);
  const invitationIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === "invitacion"
  );

  if (invitationIndex >= 0 && segments[invitationIndex + 1]) {
    return decodeURIComponent(segments[invitationIndex + 1]).trim();
  }

  return null;
}

function showError(message) {
  loadingState.classList.add("hidden");
  rsvpForm.classList.add("hidden");
  alreadyAnswered.classList.add("hidden");
  successState.classList.add("hidden");
  errorMessage.textContent = message;
  errorState.classList.remove("hidden");
}

async function loadInvitation() {
  const codigo = getCodeFromUrl();

  if (!codigo) {
    showError("Este enlace no contiene un código de invitación válido.");
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/invitacion/${encodeURIComponent(codigo)}`,
      { headers: { Accept: "application/json" } }
    );

    if (response.status === 404) {
      throw new Error("No encontramos una invitación asociada a este código.");
    }

    if (!response.ok) {
      throw new Error("No pudimos consultar tu invitación en este momento.");
    }

    invitation = await response.json();
    renderInvitation();
  } catch (error) {
    showError(
      error.message ||
        "Ocurrió un problema al conectar con la invitación. Intenta nuevamente en unos segundos."
    );
  }
}

function renderInvitation() {
  loadingState.classList.add("hidden");
  errorState.classList.add("hidden");

  familyName.textContent = invitation.nombre || "Invitados especiales";
  //invitationCode.textContent = `Código: ${invitation.codigo}`;

  const invitados = Array.isArray(invitation.invitados)
    ? invitation.invitados
    : [];

  const max = Number(invitation.max_personas) || invitados.length;
  maxGuests.textContent = max;

  if (invitation.confirmacion !== null && invitation.confirmacion !== undefined) {
    alreadyAnswered.classList.remove("hidden");

    if (invitation.confirmacion === true) {
      const names = Array.isArray(invitation.invitados_confirmados)
        ? invitation.invitados_confirmados.join(", ")
        : "";

      answeredMessage.textContent = names
        ? `Gracias por confirmar. Tenemos registrados como asistentes a: ${names}.`
        : "Gracias por confirmar que nos acompañarán.";
    } else {
      answeredMessage.textContent =
        "Gracias por avisarnos. Los tendremos presentes con mucho cariño en nuestro día.";
    }

    return;
  }

  renderGuestOptions(invitados);
  rsvpForm.classList.remove("hidden");
}

function renderGuestOptions(invitados) {
  guestList.innerHTML = "";

  invitados.forEach((nombre, index) => {
    const label = document.createElement("label");
    label.className = "guest-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "invitado";
    checkbox.value = nombre;
    checkbox.id = `guest-${index}`;

    const mark = document.createElement("span");
    mark.className = "guest-check";
    mark.textContent = "✓";
    mark.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.textContent = nombre;

    label.append(checkbox, mark, name);
    guestList.appendChild(label);

    checkbox.addEventListener("change", updateGuestSelection);
  });
}

function updateGuestSelection(event) {
  const checkboxes = [
    ...guestList.querySelectorAll('input[name="invitado"]'),
  ];

  const checked = checkboxes.filter((checkbox) => checkbox.checked);
  const max = Number(invitation.max_personas) || checkboxes.length;

  if (checked.length > max) {
    event.target.checked = false;
    guestError.textContent = `Esta invitación permite confirmar un máximo de ${max} persona${max === 1 ? "" : "s"}.`;
    guestError.classList.remove("hidden");
  } else {
    guestError.classList.add("hidden");
  }

  const updatedChecked = checkboxes.filter((checkbox) => checkbox.checked);
  selectedCount.textContent = updatedChecked.length;

  checkboxes.forEach((checkbox) => {
    const shouldDisable = updatedChecked.length >= max && !checkbox.checked;
    checkbox.disabled = shouldDisable;
    checkbox.closest(".guest-option")?.classList.toggle("is-disabled", shouldDisable);
  });
}

document.querySelectorAll('input[name="confirmacion"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    attendanceError.classList.add("hidden");

    const attending = radio.value === "true";
    guestSection.classList.toggle("hidden", !attending);

    if (!attending) {
      guestList.querySelectorAll('input[name="invitado"]').forEach((checkbox) => {
        checkbox.checked = false;
        checkbox.disabled = false;
        checkbox.closest(".guest-option")?.classList.remove("is-disabled");
      });

      selectedCount.textContent = "0";
      guestError.classList.add("hidden");
    }
  });
});

rsvpForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const attendance = rsvpForm.querySelector(
    'input[name="confirmacion"]:checked'
  );

  attendanceError.classList.toggle("hidden", Boolean(attendance));
  if (!attendance) return;

  const confirmacion = attendance.value === "true";

  const invitadosConfirmados = confirmacion
    ? [...guestList.querySelectorAll('input[name="invitado"]:checked')].map(
        (checkbox) => checkbox.value
      )
    : [];

  if (confirmacion && invitadosConfirmados.length === 0) {
    guestError.textContent = "Selecciona al menos una persona que asistirá.";
    guestError.classList.remove("hidden");
    return;
  }

  guestError.classList.add("hidden");
  setSubmitting(true);

  try {
    const response = await fetch(`${API_URL}/confirmar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        codigo: invitation.codigo,
        confirmacion,
        invitadosConfirmados,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "No pudimos registrar tu respuesta.");
    }

    rsvpForm.classList.add("hidden");
    successState.classList.remove("hidden");

    if (confirmacion) {
      successTitle.textContent = "¡Qué alegría contar con ustedes!";
      successMessage.textContent = `Registramos la asistencia de ${invitadosConfirmados.join(", ")}. Nos emociona compartir este día juntos.`;
    } else {
      successTitle.textContent = "Gracias por responder";
      successMessage.textContent =
        "Gracias por hacernos saber que en esta ocasión no podrán acompañarnos.";
    }
  } catch (error) {
    guestError.textContent =
      error.message || "Ocurrió un error al guardar la confirmación.";
    guestError.classList.remove("hidden");
  } finally {
    setSubmitting(false);
  }
});

function setSubmitting(isSubmitting) {
  submitButton.disabled = isSubmitting;
  submitButton.querySelector("span:first-child").textContent = isSubmitting
    ? "Guardando respuesta…"
    : "Confirmar respuesta";
}

loadInvitation();
