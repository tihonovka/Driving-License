import { decrypt, encrypt } from "./lcrypt.js";

const $ = (id) => document.getElementById(id);
const status = $("cryptoStatus");
function showStatus(message, isError = false) { status.textContent = message; status.classList.toggle("error", isError); }
$("encryptButton").addEventListener("click", async () => {
  const password = $("encryptPassphrase").value;
  try {
    $("encryptButton").disabled = true; showStatus("Encrypting securely…");
    $("encryptedOutput").value = await encrypt($("plainInput").value, password);
    showStatus("Encrypted message ready. Keep the passphrase private.");
  } catch { showStatus("Could not encrypt. Enter a message and passphrase.", true); }
  finally { $("encryptButton").disabled = false; }
});
$("decryptButton").addEventListener("click", async () => {
  try {
    $("decryptButton").disabled = true; showStatus("Decrypting securely…");
    $("plainOutput").value = await decrypt($("encryptedInput").value, $("decryptPassphrase").value);
    showStatus("Message authenticated and decrypted.");
  } catch { $("plainOutput").value = ""; showStatus("Unable to decrypt message. Check the passphrase or encrypted data.", true); }
  finally { $("decryptButton").disabled = false; }
});
$("copyEnvelope").addEventListener("click", async () => { if (!$("encryptedOutput").value) return; await navigator.clipboard.writeText($("encryptedOutput").value); showStatus("Encrypted message copied."); });
$("copyPlain").addEventListener("click", async () => { if (!$("plainOutput").value) return; await navigator.clipboard.writeText($("plainOutput").value); showStatus("Decrypted message copied."); });
$("pasteEnvelope").addEventListener("click", async () => { try { $("encryptedInput").value = await navigator.clipboard.readText(); showStatus("Encrypted message pasted."); } catch { showStatus("Clipboard access is unavailable. Paste the message into the box.", true); } });
