"""A synthetic document for capture and clipboard demos."""

import tkinter as tk
from datetime import datetime


TEXT = (
    "The greenhouse uses a rainwater tank for irrigation. "
    "A sensor opens the valve when the soil dries and closes it when the soil is moist. "
    "A rain gauge pauses watering during storms. "
    "The team will measure water use for two weeks before expanding the system."
)


def make_window():
    root = tk.Tk()
    root.title("Spatial Demo Document")
    root.geometry("620x340+10+38")
    root.configure(bg="#10212d")
    root.attributes("-topmost", True)
    tk.Label(root, text="FIELD NOTES   /   01", fg="#66e5ff", bg="#10212d",
             font=("Segoe UI", 13, "bold")).pack(anchor="w", padx=22, pady=(15, 2))
    tk.Label(root, text="Rainwater irrigation", fg="#e8faff", bg="#10212d",
             font=("Segoe UI", 23, "bold")).pack(anchor="w", padx=20)
    document = tk.Text(root, wrap="word", height=6, bg="#1a3040", fg="#f0f8fb",
                       insertbackground="#f0f8fb", selectbackground="#166e86",
                       relief="flat", font=("Segoe UI", 16), padx=12, pady=10)
    document.pack(fill="both", expand=True, padx=20, pady=10)
    document.insert("1.0", TEXT)
    ticker = tk.Label(root, bg="#10212d", fg="#98bdc8", font=("Segoe UI", 11))
    ticker.pack(anchor="w", padx=20, pady=(0, 12))

    def update():
        ticker.configure(text=f"LIVE DEMO DOCUMENT   •   {datetime.now():%H:%M:%S}")
        root.after(250, update)

    update()
    return root


def main():
    root = make_window()
    root.mainloop()


if __name__ == "__main__":
    main()
