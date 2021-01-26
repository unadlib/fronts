<template>
  <div class="layout-app">
    <!-- host app HOST-->
    <div class="app-label">
      # Hosting Vue App5
    </div>
    <img src="./logo.png" width="30" />
    <div class="remote-component">
      <!-- remote-component REMOTE -->
      <content-element />
      <button-element />
    </div>
  </div>
</template>

<script>
export default {};
</script>

<style scoped>
img {
  width: 200px;
}
h1 {
  font-family: Arial, Helvetica, sans-serif;
}
.remote-component {
  border: 1px solid blue;
  padding: 10px;
}
.layout-app {
  border: 1px solid green;
  padding: 10px;
}
.app-label {
  padding: 5px 2px;
  font-style: italic;
  font-size: 20px;
  color: gray;
}
</style>
