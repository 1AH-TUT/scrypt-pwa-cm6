export default function makeSplashPage() {
  const wrapper = document.createElement("div");
  wrapper.className = "splash-page";

  const label = document.createElement("span");
  label.textContent = "✨ Splash Page";
  wrapper.appendChild(label);

  return wrapper;
}
