# Poetica: Real-time AI Poetry Generation with Emotion Visualization

[![Deploy on Render](https://img.shields.io/badge/Deployed%20on-Render-blue.svg)](https://poetica-ujed.onrender.com/)


## Overview

**Poetica** is a web application that harnesses the power of AI to generate poems based on user prompts. The app also performs emotion analysis on the generated poems using advanced machine learning models. The project is a blend of modern front-end technologies and powerful back-end services, providing users with an interactive and insightful experience.

## Features

- **AI-Powered Poem Generation:** Create poems based on any prompt using the Gemini API.
- **Emotion Analysis:** Analyze the generated poems for emotions using the Hugging Face DistilBERT model.
- **Responsive Design:** A clean, user-friendly interface that works seamlessly across devices.
- **Live Deployment:** The app is live and accessible at [Poetica on Render](https://poetica-ujed.onrender.com/).

## Technologies Used

- **Front-End:**
  - HTML, CSS (Materialize CSS), JavaScript
  - Responsive design with mobile-first considerations
- **Back-End:**
  - Flask (Python)
  - Integration with Gemini API for poem generation
  - Emotion analysis using the Hugging Face DistilBERT model implemented in `emotions.py`
- **Deployment:**
  - Render for hosting and continuous deployment
  - GitHub for version control and CI/CD integration

## Installation

To run this project locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sudhanshu-Patil/Poetica.git
   cd Poetica
2. **Install the required dependencies:**
   ```bash
   pip install -r requirements.txt
3. **Run the Flask application:**
   ```bash
   python app.py
4. **Access the application:** Open your web browser and go to ` http://127.0.0.1:5000 `

## Usage
Enter your desired prompt in the text area.
Click on "Generate Poem" to create a poem based on the input.
View the generated poem and the associated emotion analysis results on the same page.

## Deployment
The application is deployed on Render, which integrates seamlessly with GitHub for continuous deployment. Any changes pushed to the main branch on GitHub will automatically trigger a new deployment on Render.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.

## Acknowledgements
Gemini API for providing poem generation capabilities.<br>
Hugging Face for the emotion analysis model.<br>
Render for hosting and deployment.
