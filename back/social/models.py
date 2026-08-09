from datetime import timedelta

from django.contrib.auth.models import User
from django.db import models
from django.db.models import F, Q
from django.utils import timezone


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    bio = models.TextField(blank=True)
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
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="media")

    MEDIA_TYPES = [
        ("image", "Image"),
        ("video", "Video"),
    ]

    file = models.FileField(upload_to="post_media/")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"Media for Post {self.post.id}"


class Story(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="stories")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(blank=True, null=True)

    related_post = models.ForeignKey(
        "Post", on_delete=models.SET_NULL, null=True, blank=True, related_name="shared_as_stories"
    )

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=24)
        super().save(*args, **kwargs)

    def is_active(self):
        return self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.user.username} - Story {self.id}"


class StoryMedia(models.Model):
    story = models.OneToOneField(Story, on_delete=models.CASCADE, related_name="media")

    MEDIA_TYPES = [
        ("image", "Image"),
        ("video", "Video"),
    ]

    file = models.FileField(upload_to="story_media/")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Media for Story {self.story.id}"


class Follow(models.Model):
    follower = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="following"
    )
    following = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="followers"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["follower", "following"], name="unique_follow"
            ),
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

    from_story = models.BooleanField(default=False)
    from_message = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.username} shared Post {self.post.id}"


class Save(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="saved_posts")
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="saved_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "post"], name="unique_save"),
        ]

    def __str__(self):
        return f"{self.user.username} saved Post {self.post.id}"


class StoryView(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="story_views")
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name="views")
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "story"], name="unique_story_view")
        ]

    def __str__(self):
        return f"{self.user.username} viewed Story {self.story.id}"


class Conversation(models.Model):
    participants = models.ManyToManyField(User, related_name="conversations")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Conversation {self.id}"


class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")

    text = models.TextField(blank=True)
    image = models.ImageField(upload_to="message_images/", blank=True, null=True)

    shared_post = models.ForeignKey(
        Post, on_delete=models.SET_NULL, null=True, blank=True, related_name="shared_in_messages"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.sender.username} in Conversation {self.conversation_id}"


class Notification(models.Model):
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="triggered_notifications")

    VERB_CHOICES = [
        ("like", "Like"),
        ("comment", "Comment"),
        ("follow", "Follow"),
        ("share", "Share"),
        ("story_share", "Story Share"),
        ("friend_share", "Friend Share"),
        ("message", "Message"),
    ]
    verb = models.CharField(max_length=20, choices=VERB_CHOICES)

    target_post = models.ForeignKey(
        Post, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications"
    )
    target_conversation = models.ForeignKey(
        Conversation, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications"
    )
    # NEW: which exact story (for story_share, to jump directly to it)
    target_story = models.ForeignKey(
        Story, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications"
    )
    # NEW: which exact comment (to highlight it on the post)
    target_comment = models.ForeignKey(
        Comment, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications"
    )

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.actor.username} -> {self.recipient.username} ({self.verb})"