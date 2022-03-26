if ("serviceWorker" in navigator) {
	navigator.serviceWorker
		.register("./sw.js")
		.then((reg) => console.log("service worker registered", reg))
		.catch((err) => console.log("service worker not registered", err))
}

var button = document.getElementById("clock-in-out")

button.onclick = () => {
	if (button.classList.contains("join")) {
		button.classList.remove("join")
		button.classList.add("leave")
		button.innerText = "Leave Queue"
	} else {
		if (confirm("Are you sure you want to leave?")) {
			button.classList.remove("leave")
			button.classList.add("join")
			button.innerText = "Join Queue"
		}
	}
}
