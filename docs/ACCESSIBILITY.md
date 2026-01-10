# Accessibility Guide

This document outlines the accessibility features implemented in Pokeflip and how to test them.

## Implemented Features

### ARIA Labels and Semantic HTML

- **Buttons**: All interactive buttons have `aria-label` attributes when the button text isn't descriptive
- **Forms**: Input fields are properly associated with labels using `htmlFor` and `id` attributes
- **Error Messages**: Error messages use `role="alert"` and `aria-live="polite"` for screen reader announcements
- **Required Fields**: Visual indicators (asterisks) with `aria-label="required"` for screen readers
- **Navigation**: Navigation links use `aria-current="page"` to indicate active page
- **Modals**: Modal dialogs use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`/`aria-describedby`

### Keyboard Navigation

- **Focus Management**: 
  - Tab order follows logical document flow
  - Focus is trapped within modals when open
  - Focus returns to trigger element when modals close
- **Keyboard Shortcuts**:
  - `Tab` / `Shift+Tab`: Navigate between interactive elements
  - `Enter` / `Space`: Activate buttons and links
  - `Escape`: Close modals
  - Arrow keys: Navigate within select dropdowns
- **Skip Links**: "Skip to main content" link available for keyboard users (visible on focus)

### Focus Indicators

- **Visible Focus**: All interactive elements have visible focus indicators
- **Focus Rings**: Custom focus rings with 2px outline and offset
- **Color Contrast**: Focus indicators meet WCAG contrast requirements
- **Custom Focus Styles**: Tailored focus styles for buttons, inputs, and links

### Screen Reader Support

- **Semantic HTML**: Proper use of HTML5 semantic elements (`<nav>`, `<main>`, `<aside>`, etc.)
- **ARIA Attributes**: Comprehensive ARIA labels, roles, and states
- **Descriptive Labels**: All form inputs have descriptive labels
- **Error Announcements**: Form errors are announced to screen readers
- **Status Updates**: Loading states and status messages use `aria-live` regions

### Other Accessibility Features

- **Reduced Motion**: Respects `prefers-reduced-motion` media query
- **High Contrast**: Supports high contrast mode via `prefers-contrast` media query
- **Color Independence**: Information is not conveyed by color alone
- **Alternative Text**: Images have appropriate alt text or are marked decorative

## Testing Guide

### Keyboard Testing

1. **Tab Navigation**:
   - Press `Tab` to move forward through interactive elements
   - Press `Shift+Tab` to move backward
   - Verify focus order is logical and all interactive elements are reachable
   - Check that focus indicators are visible

2. **Modal Testing**:
   - Open a modal
   - Press `Tab` repeatedly - focus should stay within the modal
   - Press `Shift+Tab` when on first element - should wrap to last element
   - Press `Escape` - modal should close and focus return to trigger
   - Close modal and verify focus returns to original element

3. **Form Testing**:
   - Tab to form inputs
   - Verify labels are read correctly
   - Submit invalid form - errors should be announced
   - Tab to submit button and press `Enter` or `Space`

4. **Skip Link**:
   - Press `Tab` on page load
   - Skip link should appear
   - Press `Enter` - should jump to main content

### Screen Reader Testing

#### Using VoiceOver (macOS/iOS)

1. **Enable VoiceOver**: `Cmd + F5` or Settings → Accessibility → VoiceOver
2. **Navigate**:
   - Use `Ctrl+Option+Right/Left Arrow` to move by element
   - Use `Ctrl+Option+U` to open rotor (navigation menu)
   - Use `Ctrl+Option+Space` to activate elements

3. **Test Forms**:
   - Navigate to form inputs
   - Verify labels are announced
   - Submit invalid form - verify errors are announced
   - Required fields should be announced as "required"

4. **Test Navigation**:
   - Navigate through sidebar links
   - Verify current page is announced
   - Verify link descriptions are read

5. **Test Modals**:
   - Open modal - verify title is announced
   - Navigate through modal content
   - Close modal - verify focus returns

#### Using NVDA (Windows)

1. **Download NVDA**: https://www.nvaccess.org/
2. **Navigate**:
   - Use `H` to jump to headings
   - Use `L` to jump to links
   - Use `F` to jump to forms
   - Use `Tab` to move through elements

3. **Test Forms**:
   - Navigate to inputs using `F`
   - Verify labels are read
   - Required fields should be announced

4. **Test Navigation**:
   - Use `L` to list all links
   - Verify current page link is identified
   - Navigate to links and verify descriptions

#### Using JAWS (Windows)

1. **Navigate**:
   - Use `Insert+F7` to open links list
   - Use `Insert+F6` to open headings list
   - Use `Tab` to move through interactive elements

2. **Test Forms**:
   - Use `Insert+F5` for form fields list
   - Navigate through fields
   - Verify labels and error messages are read

### Automated Testing

#### Using axe DevTools

1. Install axe DevTools browser extension
2. Navigate to a page
3. Run accessibility scan
4. Review and fix any issues

#### Using Lighthouse

1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Select "Accessibility" category
4. Run audit
5. Review accessibility score and recommendations

### Manual Checklist

- [ ] All images have alt text or are marked decorative
- [ ] All form inputs have associated labels
- [ ] All buttons have accessible names
- [ ] Color is not the only way to convey information
- [ ] Focus indicators are visible on all interactive elements
- [ ] Page can be navigated using only keyboard
- [ ] Modal dialogs trap focus and can be closed with Escape
- [ ] Error messages are announced to screen readers
- [ ] Page has proper heading hierarchy (h1 → h2 → h3)
- [ ] Links have descriptive text (not just "click here")
- [ ] Skip link is available for keyboard users
- [ ] ARIA labels are used when needed
- [ ] Page works with screen reader enabled

## Common Issues and Solutions

### Missing ARIA Labels

**Issue**: Button or link has icon but no text label

**Solution**: Add `aria-label` attribute
```tsx
<button aria-label="Close modal">
  <svg aria-hidden="true">...</svg>
</button>
```

### Form Input Not Associated with Label

**Issue**: Input field label is not read by screen reader

**Solution**: Use `htmlFor` and `id` attributes
```tsx
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

### Missing Focus Indicators

**Issue**: Can't see which element has focus

**Solution**: Add focus styles
```css
button:focus-visible {
  outline: 2px solid #000;
  outline-offset: 2px;
}
```

### Modal Not Accessible

**Issue**: Screen reader can't access modal content, focus not trapped

**Solution**: 
- Add `role="dialog"` and `aria-modal="true"`
- Trap focus within modal
- Return focus when modal closes

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

## Browser Support

Accessibility features are tested in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

Screen readers tested:
- VoiceOver (macOS/iOS)
- NVDA (Windows)
- JAWS (Windows)

