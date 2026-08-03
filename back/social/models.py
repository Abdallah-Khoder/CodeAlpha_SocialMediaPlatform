from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")

    # Optional biography written by the user
    bio = models.TextField(blank=True)

    # Optional profile picture
    profile_picture = models.ImageField(
        upload_to="profile_pictures/", blank=True, null=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.user.username


class Post(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")

    content = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Post {self.id}"


class PostMedia(models.Model):
    # A post can contain multiple media items
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="media")

    # Supported media types for posts
    MEDIA_TYPES = [
        ("image", "Image"),
        ("video", "Video"),
    ]

    # The uploaded image or video file
    file = models.FileField(upload_to="post_media/")

    # Defines whether the uploaded file is an image or a video
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)

    # Defines the order in which media items appear in a post
    order = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Media items are automatically returned in the defined order
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"Media for Post {self.post.id}"


class Story(models.Model):
    # Each story belongs to exactly one user
    # A user can create multiple stories
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="stories")

    created_at = models.DateTimeField(auto_now_add=True)

    # The story expires automatically 24 hours after creation
    expires_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        # Set the expiration time automatically when creating a new story
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)

        super().save(*args, **kwargs)

    def is_active(self):
        # Returns True if the story has not expired yet
        return self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.user.username} - Story {self.id}"


class StoryMedia(models.Model):
    # Each story must have exactly one media item
    # OneToOneField prevents a story from having multiple media records
    story = models.OneToOneField(Story, on_delete=models.CASCADE, related_name="media")

    # Supported media types for stories
    MEDIA_TYPES = [
        ("image", "Image"),
        ("video", "Video"),
    ]

    # The uploaded image or video file
    file = models.FileField(upload_to="story_media/")

    # Defines whether the uploaded file is an image or a video
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Media for Story {self.story.id}"


class Follow(models.Model):
    # The user who starts the follow relationship
    follower = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="following"
    )

    # The user being followed
    following = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="followers"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Prevent the same user from following another user more than once
            models.UniqueConstraint(
                fields=["follower", "following"], name="unique_follow"
            ),
            # Prevent a user from following themselves
            models.CheckConstraint(
                condition=~Q(follower=F("following")), name="prevent_self_follow"
            ),
        ]

    def __str__(self):
        return f"{self.follower.username} " f"follows {self.following.username}"


class Like(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="likes")

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Prevent a user from liking the same post more than once
            models.UniqueConstraint(fields=["user", "post"], name="unique_like"),
        ]

    def __str__(self):
        return f"{self.user.username} liked Post {self.post.id}"


class Comment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="comments")

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")

    text = models.TextField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - Comment {self.id}"


class Share(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="shares")

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="shares")

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} shared Post {self.post.id}"


class Save(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="saved_posts")

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="saved_by")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Prevent a user from saving the same post more than once
            models.UniqueConstraint(fields=["user", "post"], name="unique_save"),
        ]

    def __str__(self):
        return f"{self.user.username} saved Post {self.post.id}"


class StoryView(models.Model):
    # Tracks which users have viewed which stories
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="story_views")
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name="views")
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "story"], name="unique_story_view")
        ]

    def __str__(self):
        return f"{self.user.username} viewed Story {self.story.id}"