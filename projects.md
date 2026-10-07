---
layout: page
title: Projects
permalink: /projects/
---

<div class="project-tabs">
    <button class="tab-btn active" onclick="openCategory('active')">Active Research</button>
    <button class="tab-btn" onclick="openCategory('completed')">Completed</button>
    <button class="tab-btn" onclick="openCategory('fun')">Old / Just for Fun</button>
    <button class="tab-btn" onclick="openCategory('future')">Research Agenda</button>
</div>

<div class="projects-display-area">
    {% assign categories = "active,completed,fun,future" | split: "," %}
    
    {% for cat in categories %}
    <div id="{{ cat }}" class="category-container" style="display: {% if cat == 'active' %}block{% else %}none{% endif %};">
        
        <button class="nav-arrow left" onclick="changeSlide(-1, '{{ cat }}')"><i class="fas fa-chevron-left"></i></button>
        <button class="nav-arrow right" onclick="changeSlide(1, '{{ cat }}')"><i class="fas fa-chevron-right"></i></button>

        <div class="slides-wrapper">
            {% assign cat_projects = site.data.projects | where: "category", cat %}
            
            {% if cat_projects.size > 0 %}
                {% for project in cat_projects %}
                <div class="project-slide fade {% if forloop.first %}visible{% endif %}">
                    
                    <h2 class="slide-title">{{ project.title }}</h2>
                    
                    {% assign has_media = false %}
                    {% if project.gallery or project.video_id or project.image %}
                        {% assign has_media = true %}
                    {% endif %}
                    
                    <div class="slide-content {% unless has_media %}no-media-layout{% endunless %}">
                        
                        {% if has_media %}
                        <div class="slide-visual">
                            {% assign project_uid = cat | append: "-" | append: forloop.index %}
                            
                            <div id="display-{{ project_uid }}" class="visual-stack">
                                {% if project.gallery %}
                                    {% for item in project.gallery %}
                                        <div class="media-item {% if forloop.first %}active{% endif %}" data-index="{{ forloop.index0 }}">
                                            {% if item.type == 'video' %}
                                                <div class="video-container">
                                                    <iframe src="https://www.youtube.com/embed/{{ item.id }}" frameborder="0" loading="lazy" allowfullscreen></iframe>
                                                </div>
                                            {% else %}
                                                <img src="{{ item.url | relative_url }}" alt="Project Visual" class="slide-img">
                                            {% endif %}
                                        </div>
                                    {% endfor %}
                                
                                {% elsif project.video_id %}
                                    <div class="media-item active">
                                        <div class="video-container">
                                            <iframe src="https://www.youtube.com/embed/{{ project.video_id }}" frameborder="0" loading="lazy" allowfullscreen></iframe>
                                        </div>
                                    </div>
                                {% elsif project.image %}
                                    <div class="media-item active">
                                        <img src="{{ project.image | relative_url }}" alt="Project Visual" class="slide-img">
                                    </div>
                                {% endif %}
                            </div>
    
                            {% if project.gallery.size > 1 %}
                            <div class="media-controls">
                                {% for item in project.gallery %}
                                    <button class="media-dot {% if forloop.first %}active{% endif %}" 
                                            onclick="switchMedia('{{ project_uid }}', {{ forloop.index0 }})">
                                        {{ forloop.index }}
                                    </button>
                                {% endfor %}
                            </div>
                            {% endif %}
                        </div>
                        {% endif %}
                        
                        <div class="slide-text">
                            <p>{{ project.description }}</p>
                            
                            {% if project.repo %}
                            <div class="project-links">
                                <a href="{{ project.repo }}" target="_blank" class="repo-btn">
                                    <i class="fab fa-github"></i> View Code
                                </a>
                            </div>
                            {% endif %}
                        </div>

                    </div> </div> {% endfor %}
            {% else %}
                <div class="project-slide visible">
                    <div class="slide-text" style="text-align:center; padding-top: 50px;">
                        <h3>No projects added yet.</h3>
                        <p>Check back soon!</p>
                    </div>
                </div>
            {% endif %}
        </div>
    </div>
    {% endfor %}
</div>

<script>
    // 1. Tab Switching Logic
    function openCategory(categoryName) {
        var containers = document.getElementsByClassName("category-container");
        for (var i = 0; i < containers.length; i++) {
            containers[i].style.display = "none";
        }
        
        var tabs = document.getElementsByClassName("tab-btn");
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].className = tabs[i].className.replace(" active", "");
        }

        document.getElementById(categoryName).style.display = "block";
        event.currentTarget.className += " active";
        
        // Refresh arrow states when tab opens
        updateArrows(categoryName);
    }

    // 2. Slide Switching Logic
    var slideIndices = {
        'active': 0,
        'completed': 0,
        'fun': 0,
        'future': 0
    };

    function changeSlide(n, category) {
        var container = document.getElementById(category);
        var slides = container.getElementsByClassName("project-slide");
        var newIndex = slideIndices[category] + n;
        
        // STOP if trying to go out of bounds
        if (newIndex < 0 || newIndex >= slides.length) {
            return; 
        }

        // Hide old slide
        slides[slideIndices[category]].classList.remove("visible");

        // Update index
        slideIndices[category] = newIndex;

        // Show new slide
        slides[slideIndices[category]].classList.add("visible");
        
        // Update the arrow colors
        updateArrows(category);
    }

    // New Helper: Checks if arrows should be greyed out
    function updateArrows(category) {
        var container = document.getElementById(category);
        var slides = container.getElementsByClassName("project-slide");
        var currentIndex = slideIndices[category];
        var totalSlides = slides.length;

        var leftBtn = container.querySelector('.nav-arrow.left');
        var rightBtn = container.querySelector('.nav-arrow.right');

        // Reset both to active first
        leftBtn.classList.remove('disabled');
        rightBtn.classList.remove('disabled');

        // If no slides or only 1 slide, disable both
        if (totalSlides <= 1) {
            leftBtn.classList.add('disabled');
            rightBtn.classList.add('disabled');
            return;
        }

        // Disable Left if at start
        if (currentIndex === 0) {
            leftBtn.classList.add('disabled');
        }

        // Disable Right if at end
        if (currentIndex === totalSlides - 1) {
            rightBtn.classList.add('disabled');
        }
    }

    // 3. Media Switcher Logic (The 1-2-3 buttons)
    function switchMedia(projectUid, mediaIndex) {
        var container = document.getElementById("display-" + projectUid);
        var items = container.getElementsByClassName("media-item");
        
        for (var i = 0; i < items.length; i++) {
            items[i].classList.remove("active");
        }
        
        items[mediaIndex].classList.add("active");

        var controls = container.nextElementSibling;
        if (controls && controls.classList.contains("media-controls")) {
            var buttons = controls.getElementsByClassName("media-dot");
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].classList.remove("active");
            }
            buttons[mediaIndex].classList.add("active");
        }
    }

    // 4. Initialize Arrows on Page Load
    // This runs automatically to grey out the "Left" arrows immediately
    document.addEventListener("DOMContentLoaded", function() {
        var cats = ['active', 'completed', 'fun', 'future'];
        cats.forEach(function(cat) {
            updateArrows(cat);
        });

        // Open the tab named in the URL, e.g. /projects/#future
        var fromHash = location.hash.slice(1);
        var tabs = document.getElementsByClassName("tab-btn");
        for (var i = 0; i < tabs.length; i++) {
            if (fromHash && tabs[i].getAttribute("onclick").indexOf("'" + fromHash + "'") !== -1) {
                tabs[i].click();
            }
        }
    });
</script>
