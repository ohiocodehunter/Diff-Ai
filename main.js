// Cache DOM elements
const themeToggle = document.querySelector(".theme-toggle");
const promptForm = document.querySelector(".prompt-form");
const promptInput = document.querySelector(".prompt-input");
const promptBtn = document.querySelector(".prompt-btn");
const modelSelect = document.getElementById("model-select");
const countSelect = document.getElementById("count-select");
const ratioSelect = document.getElementById("ratio-select");
const gridGallery = document.querySelector(".gallery-grid");

// Replace with your own API key
const API_KEY = ""; // Hugging Face API Key

// Example prompts - preloaded for inspiration
const examplePrompts = [
  "A magic forest with glowing plants and fairy homes among giant mushrooms",
  "An old steampunk airship floating through golden clouds at sunset",
  "A future Mars colony with glass domes and gardens against red mountains",
  "A dragon sleeping on gold coins in a crystal cave",
  "An underwater kingdom with merpeople and glowing coral buildings",
  "A floating island with waterfalls pouring into clouds below",
  "A witch's cottage in fall with magic herbs in the garden",
  "A robot painting in a sunny studio with art supplies around it",
  "A magical library with floating glowing books and spiral staircases",
  "A Japanese shrine during cherry blossom season with lanterns and misty mountains",
  "A cosmic beach with glowing sand and an aurora in the night sky",
  "A medieval marketplace with colorful tents and street performers",
  "A cyberpunk city with neon signs and flying cars at night",
  "A peaceful bamboo forest with a hidden ancient temple",
  "A giant turtle carrying a village on its back in the ocean",
];

// Initialize Theme - IIFE (Immediately Invoked Function Expression)
(() => {
  const savedTheme = localStorage.getItem("theme");
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  const isDarkTheme =
    savedTheme === "dark" || (!savedTheme && systemPrefersDark);

  document.body.classList.toggle("dark-theme", isDarkTheme);
  updateThemeIcon(isDarkTheme);

  // Add system color scheme change listener
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      if (!localStorage.getItem("theme")) {
        document.body.classList.toggle("dark-theme", e.matches);
        updateThemeIcon(e.matches);
      }
    });
})();

// Update theme icon based on current theme
function updateThemeIcon(isDark) {
  themeToggle.querySelector("i").className = isDark
    ? "fa-solid fa-sun"
    : "fa-solid fa-moon";
}

// Toggle theme function
const toggleTheme = () => {
  const isDarkTheme = document.body.classList.toggle("dark-theme");
  updateThemeIcon(isDarkTheme);
  localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
};

// Calculate image dimensions based on aspect ratio
const getImageDimensions = (aspectRatio, baseSize = 512) => {
  const [width, height] = aspectRatio.split("/").map(Number);
  const scaleFactor = baseSize / Math.sqrt(width * height);

  // Calculate dimensions and ensure they're multiples of 8
  let calculatedWidth = Math.round(width * scaleFactor);
  let calculatedHeight = Math.round(height * scaleFactor);

  calculatedWidth = Math.floor(calculatedWidth / 8) * 8;
  calculatedHeight = Math.floor(calculatedHeight / 8) * 8;

  return { width: calculatedWidth, height: calculatedHeight };
};

// Show error message on image card
const showErrorOnCard = (imgIndex, errorMessage) => {
  const imgCard = document.getElementById(`img-card-${imgIndex}`);
  if (!imgCard) return;

  imgCard.classList.remove("loading");
  imgCard.classList.add("error");

  const statusText = imgCard.querySelector(".status-text");
  if (statusText) {
    statusText.textContent = errorMessage || "Failed to generate";
  }
};

// Update image card with generated image
const updateImageCard = (imgIndex, imgUrl) => {
  const imgCard = document.getElementById(`img-card-${imgIndex}`);
  if (!imgCard) return;

  // Create image element to preload
  const img = new Image();
  img.className = "result-img";
  img.src = imgUrl;

  // When image loads successfully
  img.onload = () => {
    imgCard.classList.remove("loading");
    imgCard.innerHTML = `
      <img src="${imgUrl}" class="result-img" alt="AI generated image ${
      imgIndex + 1
    }">
      <div class="img-overlay">
        <a href="${imgUrl}" class="img-download-btn" download="ai-image-${Date.now()}-${imgIndex}.png" aria-label="Download image">
          <i class="fa-solid fa-download"></i>
        </a>
      </div>`;
  };

  // Handle image load errors
  img.onerror = () => {
    showErrorOnCard(imgIndex, "Image failed to load");
  };
};

// Generate images with API call
const generateImages = async (
  selectedModel,
  imageCount,
  aspectRatio,
  promptText
) => {
  const MODEL_URL = `https://api-inference.huggingface.co/models/${selectedModel}`;
  const { width, height } = getImageDimensions(aspectRatio);

  // Create controller for potential request cancellation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

  // Process each image with Promise.allSettled for better error handling
  const imagePromises = Array.from({ length: imageCount }, async (_, i) => {
    try {
      const response = await fetch(MODEL_URL, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({
          inputs: promptText,
          parameters: {
            width,
            height,
            num_inference_steps: 30,
            guidance_scale: 7.5,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      // Get image blob and create URL
      const imageBlob = await response.blob();
      const imageUrl = URL.createObjectURL(imageBlob);

      // Update UI with the new image
      updateImageCard(i, imageUrl);
      return imageUrl;
    } catch (error) {
      console.error(`Error generating image ${i}:`, error);

      // Show appropriate error message based on error type
      if (error.name === "AbortError") {
        showErrorOnCard(i, "Request timed out");
      } else {
        showErrorOnCard(i, error.message || "Failed to generate");
      }
      return null;
    }
  });

  // Wait for all image generation attempts to complete
  await Promise.allSettled(imagePromises);
};

// Create placeholder cards with loading spinners
const createImageCards = (
  selectedModel,
  imageCount,
  aspectRatio,
  promptText
) => {
  gridGallery.innerHTML = "";

  // Create loading cards
  for (let i = 0; i < imageCount; i++) {
    gridGallery.innerHTML += `
      <div class="img-card loading" id="img-card-${i}" style="aspect-ratio: ${aspectRatio}">
        <div class="status-container">
          <div class="spinner" role="status"></div>
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p class="status-text">Generating...</p>
        </div>
      </div>`;
  }

  // Start generating images
  generateImages(selectedModel, imageCount, aspectRatio, promptText);
};

// Form validation function
const validateForm = () => {
  const selectedModel = modelSelect.value;
  const promptText = promptInput.value.trim();

  if (!selectedModel) {
    alert("Please select an AI model");
    modelSelect.focus();
    return false;
  }

  if (!promptText) {
    alert("Please enter a prompt");
    promptInput.focus();
    return false;
  }

  return true;
};

// Handle Form Submission
const handleFormSubmit = (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  // Get form values
  const selectedModel = modelSelect.value;
  const imageCount = parseInt(countSelect.value) || 1;
  const aspectRatio = ratioSelect.value || "1/1";
  const promptText = promptInput.value.trim();

  // Create image cards and start generation
  createImageCards(selectedModel, imageCount, aspectRatio, promptText);
};

// Fill prompt input with a random example
const fillRandomPrompt = () => {
  const randomIndex = Math.floor(Math.random() * examplePrompts.length);
  promptInput.value = examplePrompts[randomIndex];
  promptInput.focus();
};

// Initialize default values if empty
const initializeDefaults = () => {
  if (!countSelect.value) countSelect.value = "1";
  if (!ratioSelect.value) ratioSelect.value = "1/1";
};

// Set up event listeners
document.addEventListener("DOMContentLoaded", () => {
  // Set default values
  initializeDefaults();

  // Add event listeners
  promptForm.addEventListener("submit", handleFormSubmit);
  themeToggle.addEventListener("click", toggleTheme);
  promptBtn.addEventListener("click", fillRandomPrompt);

  // Add keyboard accessibility
  promptBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fillRandomPrompt();
    }
  });
});
