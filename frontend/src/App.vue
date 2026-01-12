<template>
  <div id="app">
    <nav class="navbar">
      <div class="nav-container">
        <h1 class="logo">SLO Eval Gateway</h1>
        <div class="nav-links">
          <router-link to="/">Dashboard</router-link>
          <router-link to="/runs">Runs</router-link>
          <router-link to="/policies">Policies</router-link>
          <router-link to="/evals">Evals</router-link>
          <router-link to="/metrics">Metrics</router-link>
        </div>
      </div>
    </nav>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>

<style scoped>
.navbar {
  background: #1a1a1a;
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.nav-container {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.nav-links {
  display: flex;
  gap: 2rem;
}

.nav-links a {
  color: #ccc;
  text-decoration: none;
  transition: color 0.2s;
}

.nav-links a:hover,
.nav-links a.router-link-active {
  color: #4CAF50;
}

.main-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}
</style>
