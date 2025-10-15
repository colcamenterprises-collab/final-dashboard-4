# Restaurant Management Dashboard - Design Style Guide

## Overview
This style guide documents the design system for the Restaurant Management Dashboard, with a **tablet-first approach** as the primary interface for daily operations.

## Primary Platform: Tablet (iPad/Android Tablet)
The tablet interface is the primary version designed for restaurant managers and staff to use during shift operations.

---

## Typography

### Font Family
- **Primary Font**: System default (Tailwind CSS defaults)
- **Consistent sizing** across all interactive elements for optimal readability

### Font Sizes - Tablet First
- **Input Fields & Placeholders**: `12px` (`text-[12px]`, `placeholder:text-[12px]`)
- **Labels**: `12px` (`text-[12px]`)
- **Body Text**: `14px` (`text-sm`)
- **Section Headings**: `16px` (`text-base`)
- **Page Titles**: `20px` (`text-xl`)

### Font Weights
- **Regular**: `font-normal` (400) - body text
- **Medium**: `font-medium` (500) - labels, secondary headings
- **Semibold**: `font-semibold` (600) - primary headings
- **Bold**: `font-bold` (700) - emphasis only when needed

---

## Border Radius (Rounded Corners)

### Tablet-First Approach: Tighter Corners
All interactive elements use **tight 8px border radius** for a modern, compact feel:

- **All Inputs**: `rounded-[8px]` (8px)
- **All Buttons**: `rounded-[8px]` (8px)
- **All Cards/Sections**: `rounded-[8px]` (8px)
- **Modals/Dialogs**: `rounded-[8px]` (8px)
- **Pills/Badges**: `rounded-full` (for status indicators only)

### Exception: Stock Review System
The Stock Review (Manual Ledger) uses **minimal 4px border radius** for maximum information density:
- **Sections**: `rounded` (4px)
- **Inputs**: `rounded` (4px)
- **Buttons**: `rounded` (4px)

---

## Spacing & Layout

### Component Padding (Tablet)
- **Sections/Cards**: `p-3` to `p-4` (12px to 16px)
- **Inputs**: `p-2` to `p-3` (8px to 12px)
- **Buttons**: `px-4 py-2` or `px-6 py-2`

### Gap Between Elements
- **Form Fields**: `gap-2` to `gap-3` (8px to 12px)
- **Section Spacing**: `space-y-3` to `space-y-4`
- **Grid Gaps**: `gap-2` (8px) for compact layouts

### Touch Targets (Critical for Tablet)
- **Minimum Height**: `min-h-[44px]` for all interactive elements
- **Button Height**: `min-h-[48px]` to `min-h-[56px]` for primary actions
- **Response Buttons**: `min-h-[48px]` on mobile, `min-h-[64px]` on larger tablets

---

## Color Palette

### Primary Colors
- **Emerald (Primary Action)**: `bg-emerald-600`, `hover:bg-emerald-700`
- **Blue (Info/Links)**: `bg-blue-600`, `hover:bg-blue-700`
- **Black (Submit/Primary)**: `bg-black`, `hover:bg-gray-800`

### Status Colors
- **Success/Pass**: `bg-green-100`, `text-green-700`
- **Error/Fail**: `bg-red-100`, `text-red-700`
- **Warning**: `bg-yellow-100`, `text-yellow-700`
- **Neutral/NA**: `bg-gray-100`, `text-gray-700`

### Background Colors
- **Main Background**: `bg-white`
- **Section Background**: `bg-gray-50`
- **Input Background**: `bg-white`
- **Disabled**: `bg-gray-100`, `opacity-50`

### Border Colors
- **Default**: `border-gray-300` (`border-2`)
- **Focus**: `border-blue-500`
- **Error**: `border-red-300` to `border-red-500`
- **Success**: `border-green-300`

---

## Components

### Manager Quick Check Modal (Fort Knox Locked)
**Typography:**
- All input fields: `text-[12px]`
- All placeholders: `placeholder:text-[12px]`
- Manager name input: `text-[12px]`
- Note textarea: `text-[12px]`
- Skip reason input: `text-[12px]`

**Borders:**
- All sections: `rounded-[8px]`
- All buttons: `rounded-[8px]`
- All inputs: `rounded-[8px]`
- Question cards: `rounded-[8px]`

**Interactive Elements:**
- Pass/Fail/NA buttons: `min-h-[48px]` on mobile, `min-h-[64px]` on tablet
- Active state: `active:scale-95` for touch feedback
- Radio indicators: Circular with blue fill when selected

### Stock Review Manual Ledger
**Typography:**
- Labels: `text-[12px]`
- Inputs: `text-sm` (14px)
- Section headers: `text-base` (16px)

**Borders:**
- All elements: `rounded` (4px) for minimal rounded corners
- Sections: White background with `shadow-md`

**Layout:**
- Individual "Save Draft" buttons per section (Rolls, Meat, Drinks)
- Sticky footer with "Save All as Draft" and "Submit All" buttons
- "View Summary" button in toolbar for historical data

### Buttons

#### Primary Button (Submit/Confirm)
```tsx
className="px-6 py-2 text-xs sm:text-sm rounded-[8px] bg-black text-white hover:bg-gray-800 active:bg-gray-900 min-h-[44px] font-semibold transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
```

#### Secondary Button (Cancel/Back)
```tsx
className="px-4 py-2 text-xs sm:text-sm border-2 border-gray-300 rounded-[8px] bg-white hover:bg-gray-50 active:bg-gray-100 min-h-[44px] font-medium transition-all active:scale-98"
```

#### Auto-fill Button (Emerald)
```tsx
className="h-9 rounded-[8px] border px-3 text-sm bg-emerald-50 hover:bg-emerald-100"
```

#### Section Save Draft Button
```tsx
className="h-8 px-4 rounded-[8px] text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
```

### Input Fields

#### Standard Text Input
```tsx
className="border-2 rounded-[8px] p-2 sm:p-3 text-[12px] min-h-[44px] focus:outline-none focus:border-blue-500 placeholder:text-[12px]"
```

#### Textarea
```tsx
className="w-full border-2 rounded-[8px] p-2 sm:p-3 text-[12px] min-h-[60px] focus:outline-none focus:border-blue-500 placeholder:text-[12px]"
```

#### Numeric Input (Stock Review)
```tsx
className="h-10 w-full rounded border px-3 text-sm"
inputMode="numeric"
pattern="[0-9]*"
```

### Cards & Sections

#### Standard Section Card
```tsx
className="mt-3 rounded-[8px] border p-3 md:p-4 shadow-md bg-white"
```

#### Question Card (Manager Check)
```tsx
className="border-2 rounded-[8px] p-3 sm:p-4 bg-gray-50"
```

#### Stock Review Section (Minimal Rounding)
```tsx
className="mt-3 rounded border p-3 md:p-4 shadow-md bg-white"
```

### Status Indicators

#### Variance Pill
```tsx
className={`text-xs px-2 py-1 rounded-full ${variance===0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
```

#### Balance Badge (Email/Library)
- Balanced: Green badge with bold styling
- Unbalanced: Red badge with bold styling

---

## Responsive Breakpoints

### Mobile First → Tablet → Desktop
- **Mobile**: `< 640px` (sm)
- **Tablet**: `640px - 1024px` (sm to lg) **← Primary Target**
- **Desktop**: `> 1024px` (lg+)

### Responsive Classes Pattern
```tsx
className="text-xs sm:text-sm md:text-base"  // Font scaling
className="p-2 sm:p-3 md:p-4"                // Padding scaling
className="gap-2 sm:gap-3 md:gap-4"          // Gap scaling
```

---

## Interaction States

### Touch Feedback (Critical for Tablet)
- **Active State**: `active:scale-95` or `active:scale-98`
- **Disabled State**: `disabled:opacity-50 disabled:cursor-not-allowed`
- **Hover State**: Subtle color change (`hover:bg-gray-50`)

### Focus States
- **Input Focus**: `focus:outline-none focus:border-blue-500`
- **Button Focus**: Visual feedback via color change

### Transitions
- **All Interactive Elements**: `transition-all duration-200`
- **Smooth Animations**: For scale, color, and opacity changes

---

## Form Validation

### Visual Indicators
- **Required Fields**: Red asterisk or border when empty (submission blocked)
- **Invalid Input**: Red border with error message
- **Valid Input**: No additional styling (clean appearance)

### Error States
```tsx
className="border-2 border-red-300 rounded-[8px] focus:border-red-500"
```

---

## Accessibility

### Touch Targets
- Minimum `44px` height for all interactive elements
- Adequate spacing between touch targets (8px minimum)

### Color Contrast
- All text meets WCAG AA standards
- High contrast for critical information

### Input Attributes
- `inputMode="numeric"` for number inputs on mobile/tablet
- `pattern="[0-9]*"` to trigger numeric keyboard
- Proper `placeholder` text for all inputs

---

## Special Design Patterns

### Sticky Elements
- **Toolbar**: `sticky top-0 z-10`
- **Footer**: `fixed bottom-0 left-0 right-0`
- **Padding Compensation**: Add bottom padding to prevent content overlap

### Modal/Dialog
- **Overlay**: `bg-black/40` (40% opacity black)
- **Content**: `rounded-xl sm:rounded-2xl` (larger radius for modals)
- **Max Height**: `max-h-[95vh]` with `overflow-y-auto`

### Summary Views
- Collapsible cards showing historical data
- "View/Edit" links to load specific dates
- Grid layout for organized information display

---

## Fort Knox Locked Systems

The following components are **locked** and require explicit approval for changes:

1. **Manager Quick Check Modal**: All styling frozen (12px fonts, 8px radius)
2. **Daily Sales & Stock Form**: Field structure and layout locked
3. **Stock Review Manual Ledger**: 4px minimal radius design locked

---

## Design Principles

1. **Tablet-First**: Design for 10-inch tablets as primary device
2. **Touch-Optimized**: All interactive elements sized for finger input
3. **Information Density**: Balance readability with space efficiency
4. **Consistent Spacing**: Use Tailwind's spacing scale consistently
5. **Clear Hierarchy**: Typography and spacing create clear visual hierarchy
6. **Fast Data Entry**: Optimize for speed in operational environments
7. **Error Prevention**: Clear validation and immediate feedback

---

## Last Updated
October 15, 2025 - V3.2A Release (Tablet-First Enhancement)
