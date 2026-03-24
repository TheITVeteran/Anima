import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/login",
    },
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
    },
    {
      path: "/avatars",
      name: "avatars",
      component: () => import("../views/AvatarSelectView.vue"),
    },
    {
      path: "/avatars/create",
      name: "avatar-create",
      component: () => import("../views/AvatarCreateView.vue"),
    },
    {
      path: "/chat",
      name: "chat",
      component: () => import("../views/ChatView.vue"),
    },
  ],
});

export { router };
