/**
 * PalettePanel.jsx
 * Left 200px panel — 10 blocks grouped by category.
 * Each block: colored 4px dot + name. No icons, no cards, no shadows.
 * Drag cursor on hover — draggable to canvas (wired up tomorrow).
 */
import { PALETTE_BY_CATEGORY, CATEGORY_COLORS } from '../data/palette';

const CATEGORY_ORDER = [
  'CORE', 'ATTENTION', 'NORM', 'VISION', 'REGULARIZATION', 'ACTIVATION',
];

export default function PalettePanel() {
  const handleDragStart = (event, block) => {
    event.dataTransfer.setData(
      'application/mulm-block',
      JSON.stringify(block),
    );
    event.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <aside className="palette-panel">
      <div className="palette-panel__header">
        <span className="palette-panel__header-label">Palette</span>
      </div>

      <div className="palette-panel__body">
        {CATEGORY_ORDER.filter((cat) => PALETTE_BY_CATEGORY[cat]).map((cat) => (
          <div key={cat} className="palette-category">
            {/* Category label row */}
            <div className="palette-category__label">
              <div
                className="palette-category__dot"
                style={{ background: CATEGORY_COLORS[cat] }}
              />
              {cat}
            </div>

            {/* Blocks in this category */}
            {PALETTE_BY_CATEGORY[cat].map((block) => (
              <div
                key={block.id}
                className="palette-block"
                draggable
                onDragStart={(e) => handleDragStart(e, block)}
              >
                <div
                  className="palette-block__dot"
                  style={{ background: CATEGORY_COLORS[cat] }}
                />
                <span className="palette-block__name">{block.label}</span>
                {block.sync_state === 'atomic' && (
                  <span className="palette-block__badge">◆</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
