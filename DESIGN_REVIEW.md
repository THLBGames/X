# Game Design Review: Tales of Heroes, Legends & Beasts

## Overview

This is a comprehensive review of the game's design, mechanics clarity, and user experience to identify areas that are lacking or unclear.

---

## Critical Issues: Unclear Mechanics & Missing Information

### 1. **No Tutorial or Onboarding System**

**Severity: HIGH**

**Issue**: Players are dropped directly into character creation with no introduction to game mechanics, goals, or how to play.

**Impact**:

- New players have no idea what to do after creating their character
- No explanation of core game loops (combat, idle skills, progression)
- High barrier to entry for new players

**Recommendations**:

- Add a brief tutorial/onboarding flow after character creation
- Include tooltips/highlights for first-time actions
- Consider a "Welcome" modal explaining the main game systems

---

### 2. **Stat System is Completely Unexplained**

**Severity: CRITICAL**

**Issue**: The game displays 6 base stats (Strength, Dexterity, Intelligence, Vitality, Wisdom, Luck) and combat stats (Attack, Defense, Magic Attack, etc.) but provides NO explanation of:

- What each base stat does
- How base stats convert to combat stats
- Which stats are important for different classes
- Why players should care about specific stats

**Current State**:

- Stats are displayed as raw numbers in CharacterPanel/CharacterSheet
- No tooltips on stat names explaining their purpose
- Formulas exist in code (`CharacterManager.calculateCombatStats`) but are never shown

**Impact**:

- Players have no way to make informed decisions about equipment, skill points, or builds
- The game feels opaque and numbers feel meaningless
- Reduces engagement with character building systems

**Recommendations**:

- Add hover tooltips to ALL stat names explaining what they do
- Show formulas or at least descriptions:
  - **Strength**: Increases physical Attack (2x), slightly increases Defense (0.5x via Dex)
  - **Dexterity**: Increases Speed (1.5x), Critical Chance (0.1%), slight Attack (0.5x)
  - **Intelligence**: Increases Magic Attack (2x), Mana (3x), Magic Defense (0.5x)
  - **Vitality**: Increases Health (10x), Defense (1.5x)
  - **Wisdom**: Increases Mana (5x), Magic Defense (1.5x), slight Magic Attack (0.5x)
  - **Luck**: Increases Critical Chance (0.1%)
- Consider a "Stats Guide" panel or help section
- Show "preview" combat stats when hovering equipment (before equipping)

---

### 3. **Combat Mechanics are Opaque**

**Severity: HIGH**

**Issue**: Players have no way to understand how combat works:

- Turn order/speed system
- Damage calculation formulas
- Defense mitigation
- Critical hits
- Status effects and their impact
- Why they win/lose fights

**Current State**:

- Combat happens automatically or with manual skill selection
- Damage numbers appear but formulas are hidden
- No explanation of why some skills are better than others

**Recommendations**:

- Add a "Combat Guide" explaining:
  - Turn-based system with speed determining order
  - Damage formula: `attack * (1 - defense / (defense + 100))`
  - Critical hits: 1.5x damage, chance based on Dexterity + Luck
  - Status effects and their durations
- Show expected damage ranges in skill tooltips
- Display defense mitigation percentage in combat UI
- Add combat log analysis/tooltips

---

### 4. **Idle Skills System Lacks Introduction**

**Severity: MEDIUM**

**Issue**: The idle skills system is a core feature but:

- No explanation of what idle skills are
- Unclear why players should use them
- No guidance on which skills to prioritize
- Resource nodes and recipes are complex without context

**Recommendations**:

- Add introductory tooltip/guide when Skills panel is first opened
- Explain the idle progression system (gather resources → craft items → gain XP)
- Highlight the connection between idle skills and combat progression
- Add brief tooltips explaining resource nodes, recipes, and crafting

---

### 5. **No Progression Guidance**

**Severity: MEDIUM**

**Issue**: After character creation, players don't know:

- What to do first (dungeons? skills? shop?)
- What their goals should be
- How systems connect together
- What to prioritize for progression

**Recommendations**:

- Add quest system guidance (if quests exist, make them more visible)
- Consider a "Next Steps" or "Recommended Actions" panel for new players
- Add visual indicators for:
  - Recommended dungeon level ranges
  - Skill progression paths
  - Equipment upgrade opportunities

---

### 6. **Missing Contextual Help**

**Severity: MEDIUM**

**Issue**: While tooltips exist, they're minimal and don't explain:

- System interactions (how skills + equipment + stats work together)
- Strategic decisions (which class/build is good for what)
- Advanced mechanics (status effects, cooldowns, mana management)

**Recommendations**:

- Expand tooltip system with more detailed explanations
- Add "?" help icons next to complex systems
- Create a "Help" or "Guide" panel in settings with comprehensive information
- Add keyboard shortcut hints (e.g., "Press 1-8 to use skills")

---

## UI/UX Issues

### 7. **Equipment Comparison is Unclear**

**Severity: MEDIUM**

**Issue**: When viewing equipment, players can't easily see:

- What stats will change if they equip an item
- How new equipment compares to current equipment
- Net stat changes before equipping

**Recommendations**:

- Show stat differences when hovering equipment (e.g., "+5 Attack, -2 Defense")
- Add "Compare" view showing current vs. new equipment side-by-side
- Highlight improved stats in green, decreased in red

---

### 8. **Skill Point Allocation Guidance**

**Severity: LOW-MEDIUM**

**Issue**: Skill tree/skill points system exists but:

- No explanation of skill point economy
- Unclear which skills are "must-haves"
- No respec option mentioned (if it exists)

**Recommendations**:

- Add tooltips explaining skill point acquisition
- Show skill prerequisites more clearly
- Add "Recommended Skills" for each class
- If respec exists, make it more visible; if not, consider adding it

---

### 9. **Dungeon Difficulty Indicators**

**Severity: LOW**

**Issue**: Dungeons show level requirements but:

- No clear indication of difficulty relative to player level
- Unclear if player is "ready" for a dungeon
- No explanation of dungeon rewards or drops

**Recommendations**:

- Add difficulty indicators (Easy/Medium/Hard/Impossible) based on level
- Show expected rewards or drop rates
- Highlight recommended dungeons for current level

---

## Missing Quality of Life Features

### 10. **No Statistics/Progress Tracking Visibility**

**Severity: LOW**

**Issue**: Statistics panel exists but:

- May not be prominently displayed or explained
- Players might not know it exists
- No clear "progress toward goals" visualization

**Recommendations**:

- Make statistics more visible and accessible
- Add progress bars for major milestones
- Show "time played", "dungeons completed", etc. more prominently

---

### 11. **Save/Load System Clarity**

**Severity: LOW**

**Issue**: Save system appears to be automatic but:

- Players might not know when/how saves happen
- No manual save option (if desired)
- Offline progress might be confusing

**Recommendations**:

- Add "Last Saved: X minutes ago" indicator
- Explain auto-save system in settings/help
- Make offline progress modal more informative

---

## Summary of Priority Recommendations

### Critical (Do First):

1. **Add stat explanations** - Tooltips on all stats explaining what they do
2. **Add stat-to-combat-stat conversion info** - Show how base stats affect combat stats
3. **Combat mechanics explanation** - Guide or tooltips explaining combat system

### High Priority:

4. **Tutorial/Onboarding** - Guide new players through first steps
5. **Idle Skills introduction** - Explain the idle progression system
6. **Equipment comparison** - Show stat changes before equipping

### Medium Priority:

7. **Progression guidance** - Help players know what to do next
8. **Expanded tooltips** - More detailed help throughout the UI
9. **Help/Guide panel** - Central location for game information

### Low Priority:

10. **Difficulty indicators** - Make dungeon selection easier
11. **Statistics visibility** - Make progress tracking more prominent
12. **Save system clarity** - Explain auto-save and offline progress

---

## Additional Observations

**Positive Aspects**:

- Clean, modern UI design (especially after recent redesigns)
- Comprehensive system architecture
- Good separation of concerns in code
- Multiple progression systems (combat, idle, quests)

**Areas of Strength**:

- Tooltip system exists (needs expansion)
- Multiple character classes and customization
- Rich item and skill systems
- Offline progress system

**Overall Assessment**:
The game has solid mechanics and systems, but suffers from a lack of information transparency. Players are expected to understand complex systems without guidance. The biggest gap is explaining **what things do** and **why players should care**. Adding comprehensive tooltips, guides, and explanations would significantly improve the new player experience.
