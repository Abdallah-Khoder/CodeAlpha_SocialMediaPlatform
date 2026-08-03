import "../styles/sidebar.css"
const SECTIONS = [
  { key: "saved", label: "Saved" },
  { key: "liked", label: "Liked" },
  { key: "commented", label: "Commented" },
  { key: "shared", label: "Shared" },
];

function Sidebar({ activeSection, onSelectSection }) {
  const handleClick = (key) => {
    // Clicking the already-active section turns it off (back to the normal feed)
    if (activeSection === key) {
      onSelectSection(null);
    } else {
      onSelectSection(key);
    }
  };

  return (
    <div className="sidebar">
      {SECTIONS.map((section) => (
        <button
          type="button"
          key={section.key}
          className={`sidebar-item ${
            activeSection === section.key ? "sidebar-item-active" : ""
          }`}
          onClick={() => handleClick(section.key)}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

export default Sidebar;