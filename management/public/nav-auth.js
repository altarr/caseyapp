// Shared nav auth: loads current user name, handles logout
(function() {
  fetch('/api/auth/me').then(function(r) { return r.json(); }).then(function(data) {
    if (data.user) {
      var els = document.querySelectorAll('.nav-user');
      els.forEach(function(el) { el.textContent = data.user.display_name || data.user.username; });
      // Hide Users link for non-admins
      if (data.user.role !== 'admin') {
        document.querySelectorAll('a[href="/users.html"]').forEach(function(a) { a.style.display = 'none'; });
      }
    }
  }).catch(function() {});

  document.querySelectorAll('.nav-logout').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      fetch('/api/auth/logout', { method: 'POST' }).then(function() {
        window.location.href = '/login.html';
      });
    });
  });
})();
