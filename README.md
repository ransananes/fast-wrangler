# FastWrangler 🚀

**FastWrangler** is a lightweight, high-performance VS Code extension for instant data exploration. Built on top of **DuckDB-Wasm**, it provides a blazing-fast alternative to heavy data tools, allowing you to profile, filter, and analyze massive datasets directly within your editor.

![FastWrangler UI](https://raw.githubusercontent.com/ransananes/fast-wrangler/main/media/preview.png) *(Placeholder for your preview image)*

## ✨ Key Features

- **Blazing Performance**: Powered by DuckDB-Wasm for lightning-fast SQL queries on local files.
- **Premium UI**: A sleek, dark-themed interface with glassmorphism and smooth animations.
- **Instant Profiling**: Generate column statistics, null counts, and distribution histograms with one click.
- **Smart Filtering**: Global search across all columns with real-time feedback.
- **Virtualized Grid**: Smoothly scroll through millions of rows without UI lag.
- **Flexible Export**: Clean your data and export it back to CSV or Parquet.
- **Python Integration**: Explore DataFrames directly from your Python debug sessions.

## 🚀 Getting Started

### Installation
Open this project in VS Code and press `F5` to launch the extension in the Extension Development Host.

### How to Use
1. **From Explorer**: Right-click any `.csv`, `.parquet` file and select **FastWrangler: Explore Data**.
2. **From Python Debugger**: Use the FastWrangler command to inspect live DataFrames during a debug session.

## 🛠️ Commands

| Command | Description |
|---------|-------------|
| `FastWrangler: Explore Data` | Opens the current file or variable in the FastWrangler viewer. |

## 📊 Supported Formats

- **CSV** (auto-detecting delimiters)
- **Parquet**

## 🎨 Premium UI Controls

- **Search Bar**: Real-time global filtering.
- **Summary Panel**: Deep insights into column distributions and stats.
- **Sorting**: Click column headers to toggle ASC/DESC sorting.
- **Export**: Save your filtered views to high-performance formats.

---

