export function notifyServerLogout() {
  void fetch("/api/auth/logout", { method: "POST", keepalive: true })
    .then((response) => {
      if (!response.ok) {
        console.error("Server logout request failed.", response.status);
      }
    })
    .catch((error) => {
      console.error("Could not notify the server about logout.", error);
    });
}
