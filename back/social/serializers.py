from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Post, PostMedia, Comment, Profile, Follow , Story, StoryMedia, StoryView


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

    class Meta:
        model = Story
        fields = ["id", "file", "media_type", "created_at", "expires_at", "is_viewed"]

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