export default function makeLibraryPage() {
  const wrapper = document.createElement("div");
  wrapper.className = "library-page";

  const label = document.createElement("span");
  label.textContent = "📚 Library Page";
  wrapper.appendChild(label);

  return wrapper;
}