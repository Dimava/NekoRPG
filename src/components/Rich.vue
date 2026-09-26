<script setup vapor>
import { computed } from 'vue'
import { to_nodes } from './rich.js'
import Money from './Money.vue'
// nested elements render through this same component; imported so the compiler binds it directly
import Rich from './Rich.vue'

// Renders game text: authored markup or display parts (see rich.js), without v-html.
const props = defineProps({
  value: { default: null },
  nodes: { type: Array, default: null },
})
const list = computed(() => props.nodes ?? to_nodes(props.value))
</script>

<template>
  <template v-for="(n, i) in list" :key="i">
    <template v-if="typeof n === 'string'">{{ n }}</template>
    <br v-else-if="n.tag === 'br'">
    <img v-else-if="n.tag === 'img'" :src="n.src" :class="n.cls" :style="n.style">
    <Money v-else-if="n.tag === 'money'" :value="n.value" />
    <b v-else-if="n.tag === 'b'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></b>
    <i v-else-if="n.tag === 'i'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></i>
    <u v-else-if="n.tag === 'u'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></u>
    <del v-else-if="n.tag === 'del'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></del>
    <div v-else-if="n.tag === 'div'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></div>
    <small v-else-if="n.tag === 'small'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></small>
    <sup v-else-if="n.tag === 'sup'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></sup>
    <sub v-else-if="n.tag === 'sub'" :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></sub>
    <span v-else :class="n.cls" :style="n.style"><Rich :nodes="n.children" /></span>
  </template>
</template>
