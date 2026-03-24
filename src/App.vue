<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { translate } from "./locales";

const route = useRoute();
const router = useRouter();

const navItems = computed(() => [
  { label: translate("app.nav.login"), path: "/login" },
  { label: translate("app.nav.avatars"), path: "/avatars" },
  { label: translate("app.nav.create"), path: "/avatars/create" },
  { label: translate("app.nav.chat"), path: "/chat" },
]);

const activePath = computed(() => route.path);
const showProtoNav = false;
</script>

<template>
  <div class="app-shell">
    <main class="app-main">
      <RouterView />
    </main>

    <nav v-if="showProtoNav" class="proto-nav">
      <button
        v-for="item in navItems"
        :key="item.path"
        class="proto-nav-btn"
        :class="{ active: activePath === item.path }"
        @click="router.push(item.path)"
      >
        {{ item.label }}
      </button>
    </nav>
  </div>
</template>
