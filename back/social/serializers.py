from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Post, PostMedia, Comment, Profile, Follow, Story , Conversation, Message


class RegisterSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = [
            "username",
            "first_name",
            "last_name",
            "password",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            first_name=validated_data["first_name"],
            last_name=validated_data["last_name"],
            password=validated_data["password"],
        )

        Profile.objects.create(user=user)

        return user


class PostMediaSerializer(serializers.ModelSerializer):
    # Simple serializer just to display media info in the response
    class Meta:
        model = PostMedia
        fields = ["id", "file", "media_type", "order"]


class PostSerializer(serializers.ModelSerializer):
    # Read-only nested list, filled automatically via related_name
    # (we'll make sure the model's related_name on PostMedia -> Post is "media")
    media = PostMediaSerializer(many=True, read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    profile_picture = serializers.SerializerMethodField()

    # Reaction counters
    likes_count = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()
    shares_count = serializers.SerializerMethodField()

    # Whether the currently logged-in user has liked / saved this post
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    # Whether the currently logged-in user already follows this post's author
    is_following_author = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id",
            "user",
            "username",
            "profile_picture",
            "content",
            "media",
            "created_at",
            "likes_count",
            "comments_count",
            "shares_count",
            "is_liked",
            "is_saved",
            "is_following_author",
        ]
        read_only_fields = ["user", "created_at"]
        extra_kwargs = {
            "content": {"required": False, "allow_blank": True}
        }

    def validate(self, data):
        # This only checks "content" itself (empty string allowed here).
        # The real "content OR files must exist" check happens in the View,
        # because uploaded files come from request.FILES, not from this data.
        return data

    def get_profile_picture(self, obj):
        profile = getattr(obj.user, "profile", None)
        if profile and profile.profile_picture:
            request = self.context.get("request")
            url = profile.profile_picture.url
            return request.build_absolute_uri(url) if request else url
        return None

    def get_likes_count(self, obj):
        return obj.likes.count()

    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_shares_count(self, obj):
        return obj.shares.count()

    def get_is_liked(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.likes.filter(user=request.user).exists()

    def get_is_saved(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.saved_by.filter(user=request.user).exists()

    def get_is_following_author(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if obj.user_id == request.user.id:
            return False
        return Follow.objects.filter(follower=request.user, following=obj.user).exists()


class CommentSerializer(serializers.ModelSerializer):
    # Expose the comment author's username directly (read-only)
    username = serializers.CharField(source="user.username", read_only=True)
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "user", "username", "profile_picture", "text", "created_at"]
        read_only_fields = ["user", "created_at"]

    def get_profile_picture(self, obj):
        profile = getattr(obj.user, "profile", None)
        if profile and profile.profile_picture:
            request = self.context.get("request")
            url = profile.profile_picture.url
            return request.build_absolute_uri(url) if request else url
        return None


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    posts_count = serializers.SerializerMethodField()
    shares_count = serializers.SerializerMethodField()
    followers_count = serializers.SerializerMethodField()
    following_count = serializers.SerializerMethodField()

    # Whether the currently logged-in user follows this profile's owner
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            "username",
            "first_name",
            "last_name",
            "bio",
            "profile_picture",
            "posts_count",
            "shares_count",
            "followers_count",
            "following_count",
            "is_following",
        ]

    def get_posts_count(self, obj):
        return obj.user.posts.count()

    def get_shares_count(self, obj):
        return obj.user.shares.count()

    def get_followers_count(self, obj):
        # People who follow this profile's user
        return obj.user.followers.count()

    def get_following_count(self, obj):
        # People this profile's user follows
        return obj.user.following.count()

    def get_is_following(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Follow.objects.filter(follower=request.user, following=obj.user).exists()


class SuggestedUserSerializer(serializers.ModelSerializer):
    profile_picture = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "profile_picture", "is_following"]

    def get_profile_picture(self, obj):
        profile = getattr(obj, "profile", None)
        if profile and profile.profile_picture:
            request = self.context.get("request")
            url = profile.profile_picture.url
            return request.build_absolute_uri(url) if request else url
        return None
    def get_is_following(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return Follow.objects.filter(follower=request.user, following=obj).exists()

class StoryItemSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    media_type = serializers.SerializerMethodField()
    is_viewed = serializers.SerializerMethodField()
    related_post_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Story
        fields = ["id", "file", "media_type", "created_at", "expires_at", "is_viewed", "related_post_id"]

    def get_file(self, obj):
        media = getattr(obj, "media", None)
        if not media:
            return None
        request = self.context.get("request")
        url = media.file.url
        return request.build_absolute_uri(url) if request else url

    def get_media_type(self, obj):
        media = getattr(obj, "media", None)
        return media.media_type if media else None

    def get_is_viewed(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return obj.views.filter(user=request.user).exists()

        return Follow.objects.filter(follower=request.user, following=obj).exists()


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source="sender.username", read_only=True)
    shared_post = serializers.SerializerMethodField()
    text = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id", "sender_username", "text", "image", "shared_post",
            "created_at", "is_edited", "is_deleted",
        ]
        read_only_fields = ["created_at", "is_edited", "is_deleted"]

    def get_text(self, obj):
        # Hide real content once a message is soft-deleted
        if obj.is_deleted:
            return ""
        return obj.text

    def get_image(self, obj):
        if obj.is_deleted or not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def get_shared_post(self, obj):
        if obj.is_deleted or not obj.shared_post:
            return None
        return PostSerializer(obj.shared_post, context=self.context).data

class ConversationSerializer(serializers.ModelSerializer):
    other_username = serializers.SerializerMethodField()
    other_profile_picture = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    last_message_at = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            "id", "other_username", "other_profile_picture",
            "last_message", "last_message_at", "unread_count",
        ]

    def _get_other_user(self, obj):
        request = self.context.get("request")
        return obj.participants.exclude(id=request.user.id).first()

    def get_other_username(self, obj):
        other = self._get_other_user(obj)
        return other.username if other else None

    def get_other_profile_picture(self, obj):
        other = self._get_other_user(obj)
        if not other:
            return None
        profile = getattr(other, "profile", None)
        if profile and profile.profile_picture:
            request = self.context.get("request")
            return request.build_absolute_uri(profile.profile_picture.url)
        return None
    def get_last_message(self, obj):
        last = obj.messages.order_by("-created_at").first()
        if not last:
            return None
        if last.is_deleted:
            return "This message was deleted"
        if last.text:
            return last.text[:60]
        if last.image:
            return "Photo"
        if last.shared_post_id:
            return "Shared a post"
        return ""

    def get_last_message_at(self, obj):
        last = obj.messages.order_by("-created_at").first()
        return last.created_at if last else obj.created_at

    def get_unread_count(self, obj):
        request = self.context.get("request")
        return obj.messages.filter(is_read=False).exclude(sender=request.user).count()