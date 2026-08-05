import { useEffect, useState } from 'react';
import styles from './JournalSaveSheet.module.css';

interface JournalSaveSheetProps {
  /** 是否显示 */
  show: boolean;
  /** 关闭浮层 */
  onClose: () => void;
  /** 把当前 textarea 内容传回父级执行保存 */
  onSave: (text: string) => void;
  /** 默认感想文字 */
  defaultText?: string;
  /** 照片标题, 用于 placeholder 默认填充 */
  pendingTitle: string;
  /** 情绪标签文字, 用于默认填充 */
  emotionLabel: string;
}

/**
 * JournalSaveSheet — 从底部滑入的"保存为日记"浮层
 *
 * 半透明遮罩 + 卡片滑入过渡, 含感想 textarea + 保存按钮。
 * 点击遮罩或关闭按钮关闭浮层。show 变 true 时重置 textarea 为 defaultText。
 */
export function JournalSaveSheet({
  show,
  onClose,
  onSave,
  defaultText,
  pendingTitle,
  emotionLabel,
}: JournalSaveSheetProps) {
  const [text, setText] = useState(
    defaultText ?? `${pendingTitle} · ${emotionLabel}`,
  );

  // show 变 true 时, 重置 textarea 为 defaultText
  useEffect(() => {
    if (show) {
      setText(defaultText ?? `${pendingTitle} · ${emotionLabel}`);
    }
  }, [show, defaultText, pendingTitle, emotionLabel]);

  const handleSave = () => {
    onSave(text);
  };

  return (
    <div
      className={`${styles.overlay} ${show ? styles.show : ''}`}
      onClick={onClose}
      aria-hidden={!show}
    >
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label="保存为日记"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <span className={styles.title}>保存为日记</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="今天的情绪，一句话记下来…"
          rows={2}
        />

        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSave}
        >
          保存为日记
        </button>
      </div>
    </div>
  );
}
