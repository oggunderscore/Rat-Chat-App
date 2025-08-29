import React from 'react';
import { motion } from 'framer-motion';
import {
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  Code as CodeIcon,
  FormatQuote as FormatQuoteIcon,
  FormatListBulleted as FormatListBulletedIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { theme } from '../styles/theme';

const MarkdownToolbar = ({ onMarkdownInsert, textareaRef }) => {
  const tools = [
    { icon: FormatBoldIcon, markdown: '**', tooltip: 'Bold' },
    { icon: FormatItalicIcon, markdown: '*', tooltip: 'Italic' },
    { icon: FormatUnderlinedIcon, markdown: '__', tooltip: 'Underline' },
    { icon: CodeIcon, markdown: '`', tooltip: 'Inline Code' },
    { icon: FormatQuoteIcon, markdown: '> ', tooltip: 'Quote', prefix: true },
    { icon: FormatListBulletedIcon, markdown: '- ', tooltip: 'List', prefix: true },
    { icon: LinkIcon, markdown: '[text](url)', tooltip: 'Link', template: true },
  ];

  const handleToolClick = (tool) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);

    let newText;
    let newCursorPos;

    if (tool.template) {
      // Handle template-based tools like links
      if (tool.markdown === '[text](url)') {
        newText = selectedText ? `[${selectedText}](url)` : '[text](url)';
        newCursorPos = start + newText.length - 4; // Position cursor at 'url'
      }
    } else if (tool.prefix) {
      // Handle prefix tools like quotes and lists
      newText = tool.markdown + selectedText;
      newCursorPos = start + tool.markdown.length + selectedText.length;
    } else {
      // Handle wrap tools like bold, italic
      newText = tool.markdown + selectedText + tool.markdown;
      newCursorPos = selectedText 
        ? start + tool.markdown.length + selectedText.length + tool.markdown.length
        : start + tool.markdown.length;
    }

    const fullText = beforeText + newText + afterText;
    onMarkdownInsert(fullText);

    // Set cursor position after state update
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        gap: theme.spacing.xs,
        padding: theme.spacing.sm,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.md,
        border: `1px solid ${theme.colors.border}`,
        marginBottom: theme.spacing.sm,
      }}
    >
      {tools.map((tool, index) => (
        <motion.button
          key={index}
          whileHover={{ scale: 1.05, backgroundColor: theme.colors.surfaceHover }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleToolClick(tool)}
          title={tool.tooltip}
          style={{
            background: 'none',
            border: 'none',
            color: theme.colors.textSecondary,
            cursor: 'pointer',
            padding: theme.spacing.sm,
            borderRadius: theme.borderRadius.sm,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: theme.transitions.fast,
          }}
        >
          <tool.icon sx={{ fontSize: 18 }} />
        </motion.button>
      ))}
    </motion.div>
  );
};

export default MarkdownToolbar;