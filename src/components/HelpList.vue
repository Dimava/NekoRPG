<script setup vapor>
import { t } from 'game/t'
import HelpText from './HelpText.vue'
// nested lists render through this same component
import HelpList from './HelpList.vue'

// A list from help_content.js: items with text, an optional sublist, and
// optionally a table, a formula or a link.
defineProps({ items: { type: Array, required: true } })

// cells past the header are notes; a short row stretches its last cell
function cells(row, width) {
  return row.map((cell, i) => ({
    cell,
    note: i >= width,
    span: i === row.length - 1 && row.length < width ? width - row.length + 1 : 1,
  }))
}
</script>

<template>
  <ul>
    <li v-for="(it, i) in items" :key="i">
      <code v-if="it.formula" class="help_formula">{{ it.formula }}</code>
      <template v-else>
        <a v-if="it.link" :href="it.link.href" target="_blank" rel="noopener">{{ it.link.text }}</a>
        <del v-if="it.del"><HelpText :value="it.text" /></del>
        <HelpText v-else :value="it.text" />
      </template>
      <table v-if="it.table" class="help_table">
        <thead>
          <tr><th v-for="(h, j) in it.table.head" :key="j">{{ t(h) }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="(row, j) in it.table.rows" :key="j">
            <td
              v-for="(c, k) in cells(row, it.table.head.length)"
              :key="k"
              :colspan="c.span"
              :class="{ help_note: c.note }"
            ><HelpText :value="c.cell" /></td>
          </tr>
        </tbody>
      </table>
      <HelpList v-if="it.sub?.length" :items="it.sub" />
    </li>
  </ul>
</template>

<style scoped>
.help_formula {
  display: block;
  margin: 4px 0 4px 1.5em;
  white-space: pre;
}
.help_table {
  border-collapse: collapse;
  margin: 6px 0;
  font-family: monospace;
}
.help_table th,
.help_table td {
  padding: 1px 8px;
  text-align: left;
  white-space: nowrap;
}
.help_table th {
  border-bottom: 1px solid gray;
}
.help_note {
  color: gray;
}
</style>
