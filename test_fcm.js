fetch("https://fcmregistrations.googleapis.com/v1/projects/task-man-3ca46/registrations", {
  method: 'POST',
  headers: {
    'x-goog-api-key': "AIzaSyB277QJjuZjdlxC-lQvajd3ag3RYQNhKls",
    'x-goog-firebase-installations-auth': 'invalid_token_just_for_testing',
    'Origin': 'https://task-man--task-man-3ca46.us-central1.hosted.app',
    'Referer': 'https://task-man--task-man-3ca46.us-central1.hosted.app/',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    web: {
      endpoint: "https://test.endpoint",
      auth: "invalid",
      p256dh: "invalid"
    }
  })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
});
