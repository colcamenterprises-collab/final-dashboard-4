# Button Style Guide - Restaurant Management Dashboard

## Overview
This document defines the standardized button styles and usage patterns throughout the Smash Brothers Burgers restaurant management dashboard application.

## Button Types

### 1. Primary Buttons (Blue/Black Background)
**Purpose**: Main actions, form submissions, primary navigation
**Visual**: Dark background with white text
**Usage Examples**:
- Form submission buttons ("Submit", "Save")
- Primary navigation actions
- Call-to-action buttons ("Get in touch")
- Main workflow triggers

**CSS Classes**:
```css
/* Blue Primary */
bg-blue-600 text-white hover:bg-blue-700 border-blue-600

/* Black Primary */
bg-black text-white hover:bg-gray-900
```

**React Implementation**:
```tsx
<Button className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600">
  <Icon className="h-4 w-4" />
  Action Text
</Button>
```

### 2. Outline Buttons (Light Background with Border)
**Purpose**: Secondary actions, toggles, filter options
**Visual**: Light background with visible border
**Usage Examples**:
- Filter buttons
- Secondary navigation
- Action toggles (like/bookmark icons)
- Cancel/alternative actions

**CSS Classes**:
```css
border border-input bg-background hover:bg-accent hover:text-accent-foreground
```

**React Implementation**:
```tsx
<Button variant="outline">
  <Icon className="h-4 w-4" />
  Secondary Action
</Button>
```

### 3. Current Page Indicators (Gray Background)
**Purpose**: Visual indication of current location/active state
**Visual**: Gray background, non-interactive
**Usage Examples**:
- Active page in navigation breadcrumbs
- Current section indicators
- Disabled state representations

**CSS Classes**:
```css
bg-gray-200 text-gray-800 border-gray-300 cursor-default
```

**React Implementation**:
```tsx
<Button variant="outline" className="bg-gray-200 text-gray-800 border-gray-300 cursor-default">
  <Icon className="h-4 w-4" />
  Current Page
</Button>
```

## Responsive Design Standards

### Sizing Patterns
- **Button Padding**: `p-2 sm:p-3 lg:p-4` for responsive padding
- **Icon Sizing**: `h-4 w-4 sm:h-5 sm:w-5` for scalable icons
- **Text Sizing**: `text-xs sm:text-sm` for readable text across devices
- **Spacing**: `space-y-1 sm:space-y-2` for icon-text combinations

### Mobile Considerations
- Full-width buttons on mobile: `w-full` class
- Adequate touch targets (minimum 44px height)
- Readable text at small screen sizes
- Proper spacing between interactive elements

## Accessibility Requirements

### Color Contrast
- **Primary buttons**: White text on dark background (WCAG AA compliant)
- **Outline buttons**: Sufficient contrast between text and background
- **Disabled states**: Reduced opacity while maintaining readability

### Interactive States
- **Focus**: Visible focus rings for keyboard navigation
- **Hover**: Clear hover state changes
- **Active**: Distinct pressed/active state
- **Disabled**: Visual indication of non-interactive state

### Screen Reader Support
- Descriptive button text
- ARIA labels for icon-only buttons
- Proper semantic HTML structure

## Usage Guidelines

### Do's
✅ Use blue primary buttons for main actions
✅ Maintain consistent hover effects within button types
✅ Use outline buttons for secondary actions
✅ Implement proper responsive sizing
✅ Ensure adequate contrast ratios
✅ Use white text on blue/black backgrounds

### Don'ts
❌ Mix button styles inconsistently
❌ Use dark text on blue backgrounds (poor contrast)
❌ Make current page indicators interactive
❌ Skip hover states on interactive buttons
❌ Use inconsistent spacing or sizing patterns
❌ Ignore mobile touch target requirements

## Component Library Integration

### Shadcn/UI Button Variants
The application uses the shadcn/ui button component with these variants:
- `variant="default"` - Primary blue button
- `variant="outline"` - Outline button with border
- `variant="secondary"` - Alternative styling (limited use)
- `variant="ghost"` - Minimal button (limited use)

### Custom Styling
When custom classes are needed, they should extend the base button component:
```tsx
<Button 
  variant="outline" 
  className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600"
>
  Custom Primary Button
</Button>
```

## Examples from Dashboard

### Navigation Buttons
```tsx
// Active page indicator
<Button variant="outline" className="bg-gray-200 text-gray-800 border-gray-300 cursor-default">
  <Package className="h-4 w-4" />
  Daily Sales & Stock (Current)
</Button>

// Navigation link
<Button variant="outline" className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600">
  <BarChart3 className="h-4 w-4" />
  Reports & Analysis
</Button>
```

### Form Buttons
```tsx
// Primary submit button
<Button className="bg-blue-600 text-white hover:bg-blue-700">
  Submit Form
</Button>

// Secondary action
<Button variant="outline">
  Save as Draft
</Button>
```

## Maintenance Notes
- Button styles should remain consistent across all pages
- Any new button patterns should be documented here
- Regular accessibility audits should verify contrast ratios
- Mobile responsiveness should be tested on actual devices
- Update this guide when new button types are introduced